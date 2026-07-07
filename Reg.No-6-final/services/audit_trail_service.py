"""
Audit trail service for tracking project changes.
Logs all project creation, updates, and deletions with before/after values.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from pathlib import Path


class AuditTrailService:
    """
    Manages audit logging for project records.
    Tracks all changes with user context, timestamps, and before/after values.
    """

    def __init__(self, data_dir: str = "data"):
        """
        Initialize audit trail service.
        
        Args:
            data_dir: Path to data directory
        """
        self.data_dir = Path(data_dir)
        self.audit_log_file = self.data_dir / "audit_log.json"
        self.config_file = self.data_dir / "audit_trail_config.json"
        
        # Load configuration
        self.config = self._load_json(self.config_file)
        
        # Load audit log (or initialize empty)
        self.audit_log = self._load_audit_log()

    def _load_json(self, filepath: Path) -> Dict[str, Any]:
        """Load JSON file."""
        if not filepath.exists():
            return {}
        
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def _load_audit_log(self) -> List[Dict[str, Any]]:
        """Load audit log from file or initialize empty."""
        if not self.audit_log_file.exists():
            return []
        
        try:
            with open(self.audit_log_file, 'r') as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, IOError):
            return []

    def _save_audit_log(self) -> bool:
        """Save audit log to file."""
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            with open(self.audit_log_file, 'w') as f:
                json.dump(self.audit_log, f, indent=2)
            return True
        except IOError:
            return False

    def log_project_creation(self, project_id: str, project_data: Dict[str, Any], 
                            user_id: str = "System", user_name: str = "System") -> bool:
        """
        Log project creation as initial audit entry.
        
        Args:
            project_id: Project ID
            project_data: Complete project record
            user_id: User ID (default: System)
            user_name: Display name (default: System)
            
        Returns:
            Success status
        """
        entry = {
            "audit_id": f"{project_id}-{datetime.now().isoformat()}",
            "project_id": project_id,
            "field_name": "project_creation",
            "old_value": None,
            "new_value": project_data,
            "change_type": "create",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now().isoformat()
        }
        
        self.audit_log.append(entry)
        return self._save_audit_log()

    def log_field_change(self, project_id: str, field_name: str, 
                        old_value: Any, new_value: Any,
                        user_id: str, user_name: str = None,
                        change_type: str = "update") -> bool:
        """
        Log a field change.
        
        Args:
            project_id: Project ID
            field_name: Name of field changed
            old_value: Previous value
            new_value: New value
            user_id: User ID making change
            user_name: Display name (optional)
            change_type: Type of change (update/system/delete)
            
        Returns:
            Success status
        """
        # Determine user name
        if user_name is None:
            user_name = user_id
        
        entry = {
            "audit_id": f"{project_id}-{field_name}-{datetime.now().isoformat()}",
            "project_id": project_id,
            "field_name": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "change_type": change_type,
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now().isoformat()
        }
        
        self.audit_log.append(entry)
        return self._save_audit_log()

    def log_status_update(self, project_id: str, old_status: str, new_status: str,
                         user_id: str, user_name: str = None) -> bool:
        """
        Log project status update via Update button.
        
        Args:
            project_id: Project ID
            old_status: Previous status (G, A, or R)
            new_status: New status (G, A, or R)
            user_id: User making change
            user_name: Display name (optional)
            
        Returns:
            Success status
        """
        return self.log_field_change(
            project_id,
            "project_status",
            old_status,
            new_status,
            user_id,
            user_name or user_id,
            change_type="update"
        )

    def get_project_audit_trail(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get complete audit trail for a project.
        
        Args:
            project_id: Project ID
            
        Returns:
            List of audit entries (newest first)
        """
        entries = [e for e in self.audit_log if e.get("project_id") == project_id]
        # Sort by timestamp descending (newest first)
        entries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return entries

    def get_recent_audit_entries(self, project_id: str, count: int = 2) -> List[Dict[str, Any]]:
        """
        Get most recent audit entries for a project.
        
        Args:
            project_id: Project ID
            count: Number of entries to return
            
        Returns:
            List of most recent audit entries
        """
        entries = self.get_project_audit_trail(project_id)
        return entries[:count]

    def format_audit_entry(self, entry: Dict[str, Any]) -> str:
        """
        Format a single audit entry for display.
        
        Args:
            entry: Audit log entry
            
        Returns:
            Formatted string
        """
        field = entry.get("field_name", "unknown")
        old_val = entry.get("old_value", "N/A")
        new_val = entry.get("new_value", "N/A")
        user = entry.get("user_name", "Unknown")
        timestamp = entry.get("timestamp", "")
        
        # Truncate long values
        old_val_str = str(old_val)[:50] if old_val is not None else "N/A"
        new_val_str = str(new_val)[:50] if new_val is not None else "N/A"
        
        return f"{field} changed from '{old_val_str}' to '{new_val_str}' by {user} on {timestamp}"

    def get_audit_trail_display(self, project_id: str, display_count: int = 1) -> Dict[str, Any]:
        """
        Get audit trail formatted for dashboard display.
        
        Args:
            project_id: Project ID
            display_count: Number of entries to show in cell
            
        Returns:
            Dictionary with 'entries', 'total_count', and 'has_view_all' flag
        """
        all_entries = self.get_project_audit_trail(project_id)
        recent_entries = all_entries[:display_count]
        
        return {
            "entries": [self.format_audit_entry(e) for e in recent_entries],
            "total_count": len(all_entries),
            "has_view_all": len(all_entries) > display_count,
            "formatted_entries": recent_entries
        }
