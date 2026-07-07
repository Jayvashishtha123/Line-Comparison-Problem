"""Flask blueprint for project and dashboard APIs."""

import json
import os

from flask import Blueprint, jsonify, render_template, request, session

from services.project_service import ProjectService

project_bp = Blueprint('project', __name__, url_prefix='/project')

# Initialize project service
project_service = ProjectService(data_dir=os.getenv('DATA_DIR', 'data'))


def _require_login():
    if not session.get('auth_user'):
        return jsonify({"success": False, "error": "Authentication required"}), 401
    return None


def _require_admin():
    auth_error = _require_login()
    if auth_error:
        return auth_error
    if session.get('role') != 'Admin':
        return jsonify({"success": False, "error": "Admin permission required"}), 403
    return None


def _extract_form_payload():
    json_data = request.get_json(silent=True)
    if json_data is not None:
        return json_data

    payload = {}
    for key in request.form.keys():
        values = request.form.getlist(key)
        if len(values) == 1:
            payload[key] = values[0]
        elif len(values) > 1:
            payload[key] = ", ".join(value for value in values if value is not None and str(value).strip())
        else:
            payload[key] = request.form.get(key, "")
    return payload


@project_bp.route('/add', methods=['GET'])
def add_project_form():
    """Display the add project form."""
    form_spec = project_service.get_form_spec()
    lovs = project_service.get_form_lovs()
    current_year, next_year = project_service.get_active_budget_years()
    
    return render_template(
        'project/add.html',
        form_spec=form_spec,
        lovs=lovs,
        current_year=current_year,
        next_year=next_year,
    )


@project_bp.route('/add', methods=['POST'])
def add_project():
    """Handle project form submission."""
    form_data = _extract_form_payload()
    
    success, project, errors = project_service.create_project(form_data)
    
    if success:
        return jsonify({
            "success": True,
            "message": f"Project '{project['project_name']}' created successfully",
            "project_id": project["project_id"],
            "project": project
        }), 201
    else:
        return jsonify({
            "success": False,
            "errors": errors
        }), 400


@project_bp.route('/<project_id>', methods=['GET'])
def view_project(project_id):
    """Display project details."""
    project = project_service.get_project(project_id)
    
    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404
    
    return jsonify(project), 200


@project_bp.route('/<project_id>/edit', methods=['GET'])
def edit_project_form(project_id):
    """Display the edit project form."""
    project = project_service.get_project(project_id)
    
    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404
    
    form_spec = project_service.get_form_spec()
    lovs = project_service.get_form_lovs()
    current_year, next_year = project_service.get_active_budget_years()
    
    return render_template(
        'project/edit.html',
        project=project,
        form_spec=form_spec,
        lovs=lovs,
        current_year=current_year,
        next_year=next_year,
    )


@project_bp.route('/<project_id>/edit', methods=['POST'])
def edit_project(project_id):
    """Handle project edit form submission."""
    form_data = _extract_form_payload()
    
    success, project, errors = project_service.update_project(project_id, form_data)
    
    if success:
        return jsonify({
            "success": True,
            "message": f"Project '{project['project_name']}' updated successfully",
            "project": project
        }), 200
    else:
        return jsonify({
            "success": False,
            "errors": errors
        }), 400


@project_bp.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project."""
    auth_error = _require_admin()
    if auth_error:
        return auth_error
    success, message = project_service.delete_project(project_id)
    
    if success:
        return jsonify({"success": True, "message": message}), 200
    else:
        return jsonify({"success": False, "error": message}), 404


@project_bp.route('/api/lovs', methods=['GET'])
def get_lovs():
    """Get all Lists of Values for form dropdowns."""
    lovs = project_service.get_form_lovs()
    return jsonify(lovs), 200


@project_bp.route('/api/form-spec', methods=['GET'])
def get_form_spec():
    """Get form specification for dynamic form rendering."""
    return jsonify(project_service.get_form_spec()), 200


@project_bp.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Get dashboard data with filters/search/pagination/group mode. Public read-only."""
    query = request.args.get('q', '').strip()
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 10))
    grouped = request.args.get('grouped', 'true').lower() != 'false'
    sort_key = request.args.get('sort_key', '').strip()
    sort_dir = request.args.get('sort_dir', 'asc').strip().lower()
    if sort_dir not in ['asc', 'desc']:
        sort_dir = 'asc'

    filters_raw = request.args.get('filters', '{}')
    try:
        filters = json.loads(filters_raw)
        if not isinstance(filters, dict):
            filters = {}
    except Exception:
        filters = {}

    result = project_service.get_dashboard_data(
        query=query,
        filters=filters,
        page=page,
        page_size=page_size,
        grouped=grouped,
        sort_key=sort_key,
        sort_dir=sort_dir,
    )
    return jsonify(result), 200


@project_bp.route('/api/search-suggestions', methods=['GET'])
def search_suggestions():
    """Return flat search suggestions (max 6). Public read-only."""
    q = request.args.get('q', '').strip()
    suggestions = project_service.get_search_suggestions(q, max_items=6)
    return jsonify({"query": q, "suggestions": suggestions}), 200


@project_bp.route('/api/initiative-suggestions', methods=['GET'])
def initiative_suggestions():
    """Return initiative name suggestions for the Project Identity form."""
    q = request.args.get('q', '').strip()
    max_items_raw = request.args.get('max_items', '500')
    try:
        max_items = int(max_items_raw)
    except Exception:
        max_items = 500
    max_items = max(1, min(max_items, 5000))
    suggestions = project_service.get_initiative_suggestions(q, max_items=max_items)
    return jsonify({"query": q, "suggestions": suggestions}), 200


@project_bp.route('/api/project-name-suggestions', methods=['GET'])
def project_name_suggestions():
    """Return project name suggestions for the Project Identity form."""
    q = request.args.get('q', '').strip()
    max_items_raw = request.args.get('max_items', '500')
    try:
        max_items = int(max_items_raw)
    except Exception:
        max_items = 500
    max_items = max(1, min(max_items, 5000))
    suggestions = project_service.get_project_name_suggestions(q, max_items=max_items)
    return jsonify({"query": q, "suggestions": suggestions}), 200


@project_bp.route('/api/project-name-duplicates', methods=['GET'])
def project_name_duplicates():
    """Return likely duplicate project records for the add-form project-name warning card."""
    q = request.args.get('q', '').strip()
    max_items_raw = request.args.get('max_items', '3')
    try:
        max_items = int(max_items_raw)
    except Exception:
        max_items = 3
    max_items = max(1, min(max_items, 10))
    matches = project_service.get_project_name_duplicate_matches(q, max_items=max_items)
    return jsonify({"query": q, "matches": matches}), 200


@project_bp.route('/api/validate-names', methods=['GET'])
def validate_project_names():
    """Validate initiative+project name uniqueness for add form blur-time checks."""
    initiative_name = (request.args.get('initiative_name') or '').strip()
    project_name = (request.args.get('project_name') or '').strip()
    valid, message = project_service.validate_name_pair(project_name, initiative_name)
    return jsonify({"valid": valid, "message": message}), 200


@project_bp.route('/api/import', methods=['POST'])
def import_projects_bulk():
    """Import projects from an Excel file with partial success support."""
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    upload = request.files.get('file')
    if not upload or not upload.filename:
        return jsonify({"success": False, "error": "Please select an Excel file to import."}), 400

    filename = (upload.filename or '').lower()
    if not (filename.endswith('.xlsx') or filename.endswith('.csv')):
        return jsonify({"success": False, "error": "Only .xlsx and .csv files are supported."}), 400

    result = project_service.import_projects_from_file(
        upload.stream,
        upload.filename,
        user_id=session.get('auth_user', 'System'),
        user_name=session.get('auth_user', 'System'),
    )
    status_code = 200 if result.get('success') else 400
    return jsonify(result), status_code


@project_bp.route('/<project_id>/status', methods=['PUT'])
def update_project_status(project_id):
    """Update project status via Update button."""
    data = request.get_json() or {}
    
    success, project, message = project_service.update_project_status(
        project_id,
        data,
        user_id=request.headers.get('X-User-ID', 'Unknown')
    )
    
    if success:
        return jsonify({
            "success": True,
            "message": message,
            "project": project
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": message
        }), 400


@project_bp.route('/<project_id>/status-dialog', methods=['GET'])
def get_status_dialog(project_id):
    """Get status update dialog payload for selected row."""
    success, dialog, message = project_service.get_status_dialog_data(project_id)
    if not success:
        return jsonify({"success": False, "error": message}), 404
    return jsonify({"success": True, "dialog": dialog}), 200


@project_bp.route('/<project_id>/all-fields', methods=['GET'])
def get_all_fields(project_id):
    """Return the raw project record for the full edit dialog."""
    project = project_service.get_project(project_id)
    if not project:
        return jsonify({"success": False, "error": f"Project {project_id} not found"}), 404
    return jsonify({"success": True, "project": project}), 200


@project_bp.route('/<project_id>/audit-trail', methods=['GET'])
def get_audit_trail(project_id):
    """Get audit trail for a project. Public read-only."""
    audit_data = project_service.get_project_audit_trail(project_id)
    
    return jsonify({
        "project_id": project_id,
        "audit_trail": audit_data
    }), 200


def _group_audit_batches(entries, threshold_seconds=5):
    """Group audit entries made in the same save action (same user, within threshold seconds)."""
    from datetime import datetime as _dt
    if not entries:
        return []
    # Sort ascending by timestamp for grouping
    sorted_entries = sorted(entries, key=lambda x: x.get("timestamp", ""))
    batches = []
    current_batch = [sorted_entries[0]]
    for entry in sorted_entries[1:]:
        last = current_batch[-1]
        try:
            t1 = _dt.fromisoformat(last["timestamp"])
            t2 = _dt.fromisoformat(entry["timestamp"])
            same_user = last.get("user_id") == entry.get("user_id")
            within_window = abs((t2 - t1).total_seconds()) <= threshold_seconds
            if same_user and within_window:
                current_batch.append(entry)
            else:
                batches.append(current_batch)
                current_batch = [entry]
        except Exception:
            batches.append(current_batch)
            current_batch = [entry]
    if current_batch:
        batches.append(current_batch)
    # Reverse so newest batch comes first
    batches.reverse()
    return batches


@project_bp.route('/<project_id>/audit-trail/full', methods=['GET'])
def get_full_audit_trail(project_id):
    """Get complete audit trail for modal view grouped by save action."""
    project = project_service.get_project(project_id)

    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404

    full_trail = project_service.audit_service.get_project_audit_trail(project_id)

    raw_batches = _group_audit_batches(full_trail)

    def _norm(v):
        """Normalise a value so that None, 'None', and '' all compare equal."""
        if v is None:
            return ""
        s = str(v).strip()
        return "" if s.lower() == "none" else s

    formatted_batches = []
    for batch in raw_batches:
        first = batch[0]
        batch_user = first.get("user_name") or first.get("user_id") or "Unknown"
        batch_ts = first.get("timestamp", "")
        batch_type = first.get("change_type", "update")
        changes = []
        for entry in batch:
            field = entry.get("field_name", "")
            change_type = entry.get("change_type", "update")
            old_val = entry.get("old_value")
            new_val = entry.get("new_value")

            # Skip project_creation entries – they carry the whole project dict
            if field == "project_creation" or change_type == "create":
                continue

            old_str = _norm(old_val)
            new_str = _norm(new_val)

            # Skip entries where nothing actually changed
            if old_str == new_str:
                continue

            changes.append({
                "field_name": field,
                "old_value": old_str,
                "new_value": new_str,
                "change_type": change_type
            })

        # Skip batches that contained no real changes after filtering
        if not changes:
            continue

        formatted_batches.append({
            "timestamp": batch_ts,
            "user": batch_user,
            "change_type": batch_type,
            "changes": changes,
            "change_count": len(changes)
        })

    return jsonify({
        "project_id": project_id,
        "project_name": project.get("project_name"),
        "total_entries": len(full_trail),
        "batches": formatted_batches
    }), 200


@project_bp.route('/api/notifications/run', methods=['POST'])
def run_notification_cycle():
    """Run scheduled notification cycle and persist notification log."""
    result = project_service.run_notification_cycle()
    return jsonify({"success": True, **result}), 200
