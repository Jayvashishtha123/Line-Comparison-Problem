import json
import openpyxl
from datetime import datetime

# Load Excel workbook
wb = openpyxl.load_workbook('data/Worksheet PMO App Hackathon  1 1.xlsx')
ws = wb['Program 2026 ']

# Get headers from row 1
headers = [cell.value for cell in ws[1]]
print(f"Headers: {headers[:10]}")

# Extract all data rows
rows = list(ws.iter_rows(min_row=2, values_only=True))
print(f"Total data rows: {len(rows)}")

# Filter out completely empty rows
rows = [r for r in rows if any(v for v in r[:5])]  # Has data in first 5 columns
print(f"Non-empty rows: {len(rows)}")

# Build projects list
projects = []
row_idx = 0
for row in rows:
    try:
        row_idx += 1
        # Extract each field based on column index
        project_id = f"PRJ-{row_idx:04d}"
        project_status = row[0] if len(row) > 0 else "G"  # Column A
        project_otd_status = row[1] if len(row) > 1 else "On-Track"  # Column B
        initiative_name = row[2] if len(row) > 2 else ""
        project_name = row[3] if len(row) > 3 else ""
        
        # Skip completely blank rows
        if not initiative_name or not project_name:
            continue
        
        description = row[4] if len(row) > 4 else ""
        dt_team = row[5] if len(row) > 5 else "Enterprise Applications"
        state = row[6] if len(row) > 6 else "Active"
        phase = row[7] if len(row) > 7 else "Discovery"
        estd_end_date = row[8] if len(row) > 8 else ""
        adjusted_end_date = row[9] if len(row) > 9 else ""
        category = row[10] if len(row) > 10 else "Strategic/LTGrowth"
        business_unit = row[11] if len(row) > 11 else "All"
        primary_function = row[12] if len(row) > 12 else "All"
        region = row[13] if len(row) > 13 else "Global"
        executive_sponsor = row[14] if len(row) > 14 else ""
        budget_flag = row[15] if len(row) > 15 else "N"
        benefits_flag = row[16] if len(row) > 16 else "N"
        dt_teams = row[17] if len(row) > 17 else "All"
        filter_key = row[18] if len(row) > 18 else f"{dt_team}{primary_function}"
        dt_lead = row[19] if len(row) > 19 else ""
        business_lead = row[20] if len(row) > 20 else ""
        level_effort = row[21] if len(row) > 21 else ""
        technology = row[22] if len(row) > 22 else ""
        budget = row[23] if len(row) > 23 else ""
        
        # Normalize dates
        if isinstance(estd_end_date, datetime):
            estd_end_date = estd_end_date.strftime("%Y-%m-%d")
        elif not estd_end_date:
            estd_end_date = ""
        else:
            estd_end_date = str(estd_end_date)
            
        if isinstance(adjusted_end_date, datetime):
            adjusted_end_date = adjusted_end_date.strftime("%Y-%m-%d")
        elif not adjusted_end_date:
            adjusted_end_date = ""
        else:
            adjusted_end_date = str(adjusted_end_date)
        
        project = {
            "project_id": project_id,
            "project_status": str(project_status or "").strip() or "G",
            "initiative_name": str(initiative_name or "").strip(),
            "project_name": str(project_name or "").strip(),
            "description": str(description or "").strip(),
            "dt_team_accountable": str(dt_team or "Enterprise Applications").strip(),
            "project_otd_status": str(project_otd_status or "On-Track").strip(),
            "state": str(state or "Active").strip(),
            "project_otd_phase": str(phase or "Discovery").strip(),
            "estd_end_date": str(estd_end_date or "").strip(),
            "adjusted_end_date": str(adjusted_end_date or "").strip(),
            "category": str(category or "Strategic/LTGrowth").strip(),
            "business_unit": str(business_unit or "All").strip(),
            "primary_function": str(primary_function or "All").strip(),
            "region": str(region or "Global").strip(),
            "executive_sponsor": str(executive_sponsor or "").strip(),
            "budget_2026_flag": str(budget_flag or "N").strip(),
            "benefits_plan_2026": str(benefits_flag or "N").strip(),
            "dt_teams_involved": str(dt_teams or "All").strip(),
            "filter_key": str(filter_key or "").strip(),
            "dt_lead": str(dt_lead or "").strip(),
            "business_project_lead": str(business_lead or "").strip(),
            "level_of_effort": str(level_effort or "").strip(),
            "technology": str(technology or "").strip(),
            "budget": str(budget or "").strip()
        }
        
        projects.append(project)
    except Exception as e:
        print(f"Error processing row {row_idx}: {e}")
        continue

print(f"Successfully parsed {len(projects)} projects")

# Create metadata and export
portfolio = {
    "metadata": {
        "source_workbook": "Worksheet PMO App Hackathon  1 1.xlsx",
        "source_sheet": "Program 2026 ",
        "description": "Complete development dataset from Program 2026 sheet",
        "generated_on": datetime.now().strftime("%Y-%m-%d"),
        "record_count": len(projects)
    },
    "projects": projects
}

# Write to file
with open('data/portfolio_dummy.json', 'w') as f:
    json.dump(portfolio, f, indent=2)

print(f"✓ Written {len(projects)} projects to data/portfolio_dummy.json")
