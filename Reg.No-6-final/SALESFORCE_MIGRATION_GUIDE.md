# Salesforce Migration Guide: Portfolio Management Dashboard

## Executive Summary
This guide converts the Flask Portfolio Management Dashboard into a native Salesforce application using Salesforce technologies instead of Python/Flask.

---

## Phase 1: Setup Your Salesforce Organization

### Step 1.1: Access Salesforce Developer Edition
```
1. Go to https://developer.salesforce.com/signup
2. Sign up for a Free Developer Edition org
3. Verify your email
4. Complete the signup process
5. You'll get access to: 
   - Full Salesforce platform
   - Free sandbox
   - Developer tools
```

### Step 1.2: Enable Development Mode & Tools
```
1. Log into your Salesforce org
2. Settings → Develop → Enable Debug Mode
3. Settings → Develop → Visual Studio Code Setup
4. Download Salesforce CLI from: https://developer.salesforce.com/tools/sfdxcli
5. Install Salesforce Extension Pack for VS Code
```

---

## Phase 2: Data Model Design (Replaces portfolio.json)

### Step 2.1: Create Custom Objects

#### Object 1: Project__c (Main Project Data)
```
Field Name              | Type           | Required | Notes
-----------------------------------------------------------
Name                   | Text (80)      | Yes      | Project Name
ProjectID__c           | Text (20)      | Yes      | Unique ID
Description__c         | Long Text      |          | Project Description
Status__c              | Picklist       | Yes      | Planning/Active/Closed
Priority__c            | Picklist       | Yes      | High/Medium/Low
Budget__c              | Currency       |          | Total Budget
StartDate__c           | Date           |          | Project Start
EndDate__c             | Date           |          | Project End
Owner__c               | Lookup (User)  | Yes      | Project Manager
Department__c          | Picklist       | Yes      | Org Department
Region__c              | Picklist       | Yes      | Geographic Region
Status_Date__c         | Date/Time      |          | Last Update
PrimaryPOC__c          | Text (255)     |          | Primary Contact
SecondaryPOC__c        | Text (255)     |          | Secondary Contact
PrimaryPOCEmail__c     | Email          |          | Primary Email
SecondaryPOCEmail__c   | Email          |          | Secondary Email
PMOStatus__c           | Picklist       |          | PMO Status
ApprovedDate__c        | Date           |          | Approval Date
ApprovedBy__c          | Lookup (User)  |          | Approved By
Stakeholders__c        | Long Text      |          | Stakeholder List
```

**To Create in Salesforce:**
```
1. Go to Setup → Object Manager
2. Click "Create" → "Custom Object"
3. Label: "Project"
4. Plural Label: "Projects"
5. Record Name: "Project Name"
6. Data Type: "Text"
7. Enable Activities, Notes, Attachments
8. Click "Save"
```

#### Object 2: ProjectAuditTrail__c (Audit Log)
```
Field Name          | Type              | Notes
---------------------------------------------------
ProjectID__c        | Text (20)         | Link to Project
Action__c           | Text              | Create/Update/Delete
ChangedFields__c    | Long Text         | JSON of changes
OldValue__c         | Long Text         | Previous values
NewValue__c         | Long Text         | New values
ChangedBy__c        | Lookup (User)     | Who made change
ChangedDate__c      | Date/Time         | When changed
Description__c      | Long Text         | Change description
```

#### Object 3: ProjectNotification__c (Notification Log)
```
Field Name          | Type              | Notes
---------------------------------------------------
ProjectID__c        | Text (20)         | Link to Project
NotificationType__c | Picklist          | Email/In-App/System
Status__c           | Picklist          | Sent/Pending/Failed
RecipientEmail__c   | Email             | Recipient
Message__c          | Long Text         | Notification message
CreatedDate__c      | Date/Time         | Auto
SentDate__c         | Date/Time         | Auto
ErrorMessage__c     | Long Text         | If failed
```

### Step 2.2: How to Create These Objects
```
Setup → Object Manager → Create → Custom Object

Repeat for each object above, adding all fields
```

---

## Phase 3: Backend Logic (Replaces Flask Services)

### Step 3.1: Create Apex Classes (Backend Logic)

#### Class 1: ProjectService (Replaces project_service.py)
**Create File:** `ProjectService.cls`

```apex
public class ProjectService {
    
    // Get all projects
    public static List<Project__c> getAllProjects() {
        return [
            SELECT Id, Name, ProjectID__c, Status__c, Priority__c, 
                   Budget__c, StartDate__c, EndDate__c, Owner.Name,
                   Department__c, Region__c
            FROM Project__c
            ORDER BY StartDate__c DESC
            LIMIT 10000
        ];
    }
    
    // Get single project by ID
    public static Project__c getProjectById(String projectId) {
        return [
            SELECT Id, Name, ProjectID__c, Status__c, Priority__c,
                   Budget__c, StartDate__c, EndDate__c, Owner.Name,
                   Description__c, Department__c, Region__c,
                   PrimaryPOC__c, SecondaryPOC__c
            FROM Project__c
            WHERE ProjectID__c = :projectId
            LIMIT 1
        ];
    }
    
    // Create project
    public static Project__c createProject(Map<String, Object> projectData) {
        Project__c project = new Project__c();
        project.Name = (String) projectData.get('name');
        project.ProjectID__c = (String) projectData.get('projectId');
        project.Status__c = (String) projectData.get('status');
        project.Priority__c = (String) projectData.get('priority');
        project.Budget__c = (Decimal) projectData.get('budget');
        project.StartDate__c = (Date) projectData.get('startDate');
        project.EndDate__c = (Date) projectData.get('endDate');
        project.Department__c = (String) projectData.get('department');
        project.Region__c = (String) projectData.get('region');
        project.Description__c = (String) projectData.get('description');
        
        insert project;
        
        // Log audit trail
        AuditTrailService.logAction('CREATE', projectData, null, project);
        
        return project;
    }
    
    // Update project
    public static Project__c updateProject(String projectId, Map<String, Object> updates) {
        Project__c project = getProjectById(projectId);
        
        Map<String, Object> oldValues = new Map<String, Object>{
            'name' => project.Name,
            'status' => project.Status__c,
            'priority' => project.Priority__c,
            'budget' => project.Budget__c
        };
        
        project.Name = (String) updates.get('name') ?? project.Name;
        project.Status__c = (String) updates.get('status') ?? project.Status__c;
        project.Priority__c = (String) updates.get('priority') ?? project.Priority__c;
        project.Budget__c = (Decimal) updates.get('budget') ?? project.Budget__c;
        
        update project;
        
        AuditTrailService.logAction('UPDATE', updates, oldValues, project);
        
        return project;
    }
    
    // Delete project
    public static void deleteProject(String projectId) {
        Project__c project = getProjectById(projectId);
        
        Map<String, Object> deletedData = new Map<String, Object>{
            'name' => project.Name,
            'status' => project.Status__c,
            'projectId' => project.ProjectID__c
        };
        
        delete project;
        AuditTrailService.logAction('DELETE', null, deletedData, null);
    }
    
    // Validate duplicate project names
    public static Boolean isProjectNameDuplicate(String projectName, String excludeId) {
        Integer count = [
            SELECT COUNT() 
            FROM Project__c 
            WHERE Name = :projectName 
            AND ProjectID__c != :excludeId
        ];
        return count > 0;
    }
}
```

**To Create in Salesforce:**
```
1. Go to Setup → Object Manager → Apex Classes
2. Click "New"
3. Paste the code above
4. Click "Save"
```

#### Class 2: ValidationService
```apex
public class ValidationService {
    
    public static Map<String, String> validateProject(Map<String, Object> projectData) {
        Map<String, String> errors = new Map<String, String>();
        
        // Validate required fields
        if (String.isEmpty((String) projectData.get('name'))) {
            errors.put('name', 'Project name is required');
        }
        
        if (String.isEmpty((String) projectData.get('status'))) {
            errors.put('status', 'Status is required');
        }
        
        if (String.isEmpty((String) projectData.get('department'))) {
            errors.put('department', 'Department is required');
        }
        
        // Validate dates
        Date startDate = (Date) projectData.get('startDate');
        Date endDate = (Date) projectData.get('endDate');
        
        if (startDate != null && endDate != null && endDate < startDate) {
            errors.put('endDate', 'End date must be after start date');
        }
        
        // Validate email format
        String primaryEmail = (String) projectData.get('primaryPOCEmail');
        if (!String.isEmpty(primaryEmail) && !isValidEmail(primaryEmail)) {
            errors.put('primaryPOCEmail', 'Invalid email format');
        }
        
        return errors;
    }
    
    private static Boolean isValidEmail(String email) {
        String emailRegex = '^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$';
        Pattern pattern = Pattern.compile(emailRegex);
        Matcher matcher = pattern.matcher(email);
        return matcher.matches();
    }
}
```

#### Class 3: AuditTrailService
```apex
public class AuditTrailService {
    
    public static void logAction(String action, Map<String, Object> newValues, 
                                 Map<String, Object> oldValues, Project__c project) {
        ProjectAuditTrail__c auditLog = new ProjectAuditTrail__c();
        auditLog.Action__c = action;
        auditLog.ProjectID__c = project?.ProjectID__c ?? '';
        auditLog.ChangedBy__c = UserInfo.getUserId();
        auditLog.ChangedDate__c = DateTime.now();
        auditLog.Description__c = action + ' action performed on project';
        
        if (newValues != null) {
            auditLog.NewValue__c = JSON.serialize(newValues);
        }
        if (oldValues != null) {
            auditLog.OldValue__c = JSON.serialize(oldValues);
        }
        
        insert auditLog;
    }
}
```

---

## Phase 4: API Layer (Replaces Flask Routes)

### Step 4.1: Create REST API Endpoints

**Create Class:** `ProjectAPIController.cls`

```apex
@RestResource(urlMapping='/project/*')
global class ProjectAPIController {
    
    @HttpGet
    global static void getProjects() {
        List<Project__c> projects = ProjectService.getAllProjects();
        System.debug(JSON.serializePretty(projects));
    }
    
    @HttpPost
    global static void createProject() {
        try {
            String requestBody = RestContext.request.requestBody.toString();
            Map<String, Object> projectData = 
                (Map<String, Object>) JSON.deserializeUntyped(requestBody);
            
            Map<String, String> validationErrors = 
                ValidationService.validateProject(projectData);
            
            if (!validationErrors.isEmpty()) {
                RestContext.response.statusCode = 400;
                RestContext.response.responseBody = 
                    Blob.valueOf(JSON.serialize(validationErrors));
                return;
            }
            
            Project__c newProject = ProjectService.createProject(projectData);
            RestContext.response.statusCode = 201;
            RestContext.response.responseBody = 
                Blob.valueOf(JSON.serializePretty(newProject));
        } catch (Exception e) {
            RestContext.response.statusCode = 500;
            RestContext.response.responseBody = 
                Blob.valueOf(JSON.serialize(new Map<String, String>{
                    'error' => e.getMessage()
                }));
        }
    }
}
```

---

## Phase 5: Frontend (Lightning Web Component - Replaces HTML/JS)

### Step 5.1: Create Lightning Web Component

**Create Component:** `portfolioDashboard.html`

```html
<template>
    <lightning-card title="Project Portfolio Dashboard">
        <div class="slds-p-around_medium">
            
            <!-- Filter Section -->
            <div class="slds-box slds-m-bottom_large">
                <lightning-button 
                    label="+ Add New Project" 
                    onclick={handleNewProject}
                    variant="brand">
                </lightning-button>
            </div>
            
            <!-- Projects Table -->
            <lightning-datatable
                key-field="Id"
                data={projects}
                columns={columns}
                onrowaction={handleRowAction}>
            </lightning-datatable>
            
            <!-- Modal for Add/Edit -->
            <template if:true={showModal}>
                <section role="dialog" tabindex="-1" 
                         class="slds-modal slds-fade-in-open">
                    <div class="slds-modal__container">
                        <header class="slds-modal__header slds-theme_default">
                            <h2 class="slds-text-heading_medium">
                                {modalTitle}
                            </h2>
                        </header>
                        <div class="slds-modal__content slds-p-around_medium">
                            <lightning-record-form
                                record-id={selectedProjectId}
                                object-api-name="Project__c"
                                fields={formFields}
                                onsubmit={handleFormSubmit}
                                onsuccess={handleFormSuccess}>
                            </lightning-record-form>
                        </div>
                        <footer class="slds-modal__footer">
                            <lightning-button 
                                label="Cancel" 
                                onclick={handleCancel}
                                variant="neutral">
                            </lightning-button>
                            <lightning-button 
                                label="Save" 
                                onclick={handleSave}
                                variant="brand">
                            </lightning-button>
                        </footer>
                    </div>
                </section>
            </template>
        </div>
    </lightning-card>
</template>
```

**Create Component:** `portfolioDashboard.js`

```javascript
import { LightningElement, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProjects from '@salesforce/apex/ProjectService.getAllProjects';
import createProject from '@salesforce/apex/ProjectService.createProject';
import updateProject from '@salesforce/apex/ProjectService.updateProject';
import deleteProject from '@salesforce/apex/ProjectService.deleteProject';

export default class PortfolioDashboard extends LightningElement {
    @track projects = [];
    @track showModal = false;
    @track selectedProjectId;
    @track modalTitle = 'Add New Project';
    @track formFields = [
        'Project__c.Name',
        'Project__c.ProjectID__c',
        'Project__c.Status__c',
        'Project__c.Priority__c',
        'Project__c.Budget__c',
        'Project__c.StartDate__c',
        'Project__c.EndDate__c',
        'Project__c.Department__c',
        'Project__c.Region__c'
    ];

    columns = [
        { label: 'Project Name', fieldName: 'Name' },
        { label: 'Project ID', fieldName: 'ProjectID__c' },
        { label: 'Status', fieldName: 'Status__c' },
        { label: 'Priority', fieldName: 'Priority__c' },
        { label: 'Budget', fieldName: 'Budget__c', type: 'currency' },
        { label: 'Start Date', fieldName: 'StartDate__c', type: 'date' },
        { label: 'Actions', type: 'action', typeAttributes: { 
            rowActions: [
                { label: 'Edit', name: 'edit' },
                { label: 'Delete', name: 'delete' }
            ]
        }}
    ];

    @wire(getProjects)
    wiredProjects({ error, data }) {
        if (data) {
            this.projects = data;
        } else if (error) {
            this.showToast('Error', error.body?.message, 'error');
        }
    }

    handleNewProject() {
        this.modalTitle = 'Add New Project';
        this.selectedProjectId = null;
        this.showModal = true;
    }

    handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;

        switch (action) {
            case 'edit':
                this.handleEditProject(row);
                break;
            case 'delete':
                this.handleDeleteProject(row);
                break;
        }
    }

    handleEditProject(project) {
        this.modalTitle = `Edit: ${project.Name}`;
        this.selectedProjectId = project.Id;
        this.showModal = true;
    }

    handleDeleteProject(project) {
        if (confirm(`Are you sure you want to delete ${project.Name}?`)) {
            deleteProject({ projectId: project.ProjectID__c })
                .then(() => {
                    this.showToast('Success', 'Project deleted', 'success');
                    return getProjects();
                })
                .catch(error => {
                    this.showToast('Error', error.body?.message, 'error');
                });
        }
    }

    handleFormSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;
        this.template.querySelector('lightning-record-form').submit(fields);
    }

    handleFormSuccess() {
        this.showToast('Success', 'Project saved successfully', 'success');
        this.showModal = false;
        return getProjects();
    }

    handleCancel() {
        this.showModal = false;
    }

    handleSave() {
        this.template.querySelector('lightning-record-form').submit();
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
```

**Create Metadata File:** `portfolioDashboard.js-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__HomePage</target>
    </targets>
</LightningComponentBundle>
```

---

## Phase 6: Deployment Steps

### Step 6.1: Deploy Using Salesforce CLI

```bash
# 1. Install Salesforce CLI
# macOS:
brew install salesforce-cli

# 2. Authenticate to your org
sfdx force:auth:web:login -a ProductionOrg

# 3. Create a project structure
sfdx force:project:create -n portfolio-dashboard

# 4. Deploy components
sfdx force:source:deploy -p force-app/main/default -u ProductionOrg

# 5. Or use the VS Code extension:
# - Install "Salesforce Extension Pack"
# - Open command palette (Cmd+Shift+P)
# - Type "SFDX: Authorize an Org"
# - Deploy by right-clicking files
```

### Step 6.2: Manual Deployment (No CLI)

```
1. Go to Setup → Migrate Tools → Data Import Wizard
2. Copy your JSON data into Salesforce
3. Setup → Develop → Apex Classes (paste the code manually)
4. Setup → Lightning Experience → App Manager (create new app)
5. Add your Lightning Component to the app
```

---

## Phase 7: User & Permission Setup

### Step 7.1: Create Permission Set for Portfolio Managers

```
1. Setup → Users → Permission Sets
2. Click "New"
3. Label: "Portfolio Manager"
4. Assign permissions:
   - Read/Create/Update/Delete on Project__c
   - Read/Create/Update/Delete on ProjectAuditTrail__c
   - Read on ProjectNotification__c
5. Assign to users
```

### Step 7.2: Create Roles

```
Setup → Users → Roles
1. Create role hierarchy for PMO
2. Assign users to roles
3. Set field-level security
```

---

## Phase 8: Data Migration

### Step 8.1: Export Data from Flask App

```python
# Run this in your Flask project directory
import json
from pathlib import Path

# Convert portfolio.json to Salesforce import format
with open('data/portfolio.json', 'r') as f:
    portfolio_data = json.load(f)

# Export as CSV for Salesforce Data Import Wizard
import csv
with open('projects_export.csv', 'w', newline='') as csvfile:
    fieldnames = ['Name', 'ProjectID__c', 'Status__c', 'Priority__c', 
                  'Budget__c', 'StartDate__c', 'EndDate__c']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(portfolio_data.get('projects', []))
```

### Step 8.2: Import into Salesforce

```
1. Setup → Data Import Wizard (or Data Loader)
2. Select "Projects" object
3. Upload your CSV file
4. Map fields correctly
5. Review and start import
```

---

## Phase 9: Testing Checklist

- [ ] Can create new projects
- [ ] Can edit existing projects
- [ ] Can delete projects
- [ ] Audit trail logs all actions
- [ ] Validation rules work correctly
- [ ] Users cannot access other users' data (if applicable)
- [ ] Email notifications work
- [ ] Reports and dashboards display correctly
- [ ] Mobile view works properly

---

## Phase 10: Security Best Practices

```
1. Setup → Security → Session Settings
   - Set timeout to 2 hours
   - Enable two-factor authentication

2. Setup → Security → Network Access
   - Restrict login IP ranges if needed

3. Setup → Security → Field Audit Trail
   - Enable field history tracking

4. Setup → Transaction Security Policies
   - Monitor suspicious activities

5. Setup → Event Monitoring
   - Track all object changes
```

---

## Key Differences: Flask → Salesforce

| Aspect | Flask | Salesforce |
|--------|-------|-----------|
| Backend | Python (app.py) | Apex (Classes) |
| Frontend | HTML/JS | Lightning Web Components |
| Database | JSON files | Salesforce Objects |
| Authentication | Session-based | Salesforce OAuth |
| Audit Trail | JSON log | Native Audit Trail |
| Scheduling | APScheduler | Scheduled Apex Jobs |
| API | Flask routes | REST Apex |
| Hosting | Your server | Salesforce cloud |
| Scalability | Limited | Enterprise-grade |

---

## Resources

- **Salesforce Developer Docs**: https://developer.salesforce.com/docs
- **Apex Language Guide**: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode
- **Lightning Web Components**: https://developer.salesforce.com/docs/component-library/overview/components
- **Salesforce CLI**: https://developer.salesforce.com/tools/sfdxcli
- **Trailhead Modules**: https://trailhead.salesforce.com/

---

## Next Steps

1. ✅ Create a free Developer Edition org
2. ✅ Create custom objects (Project__c, ProjectAuditTrail__c)
3. ✅ Write Apex classes for business logic
4. ✅ Create Lightning Web Component for UI
5. ✅ Deploy and test
6. ✅ Migrate data from Flask app
7. ✅ Set up permissions and sharing rules
8. ✅ Configure notifications and workflows

Need help with any specific phase? Let me know!
