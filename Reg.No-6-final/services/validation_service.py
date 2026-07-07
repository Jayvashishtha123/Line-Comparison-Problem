"""
Validation service for project form and data integrity.
Handles date, enum, text, numeric, and conditional validations.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Tuple, Optional


class ValidationError(Exception):
    """Custom exception for validation errors."""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


class ProjectFormValidator:
    """
    Validates project form submissions according to business rules and data contracts.
    """

    EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    def __init__(self, form_spec: Dict[str, Any]):
        """
        Initialize validator with form specification.
        
        Args:
            form_spec: Dictionary containing project form schema and validation rules
        """
        self.form_spec = form_spec
        self.lovs = form_spec.get("form_lovs", {})
        self.rules = form_spec.get("validation_rules", {})
        self.defaults = form_spec.get("form_defaults", {})
        self.system_fields = form_spec.get("system_generated_fields", [])

    def validate_form(self, data: Dict[str, Any]) -> Tuple[bool, List[ValidationError]]:
        """
        Validate entire form submission.
        
        Args:
            data: Form data dictionary
            
        Returns:
            Tuple of (is_valid, list of ValidationError objects)
        """
        errors: List[ValidationError] = []

        # Validate each section
        for section in self.form_spec.get("project_form", {}).get("sections", []):
            for field in section.get("fields", []):
                field_id = field.get("field_id")
                
                # Skip system-generated fields (they should not be provided by user)
                if field.get("is_system_generated"):
                    continue

                field_value = data.get(field_id)
                field_errors = self._validate_field(field, field_value)
                errors.extend(field_errors)

        # Validate cross-field dependencies
        cross_field_errors = self._validate_cross_field_rules(data)
        errors.extend(cross_field_errors)

        return len(errors) == 0, errors

    def _validate_field(self, field: Dict[str, Any], value: Any) -> List[ValidationError]:
        """
        Validate a single field against its schema.
        
        Args:
            field: Field schema definition
            value: Field value to validate
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors: List[ValidationError] = []
        field_id = field.get("field_id")
        field_type = field.get("type")
        required = field.get("required", False)
        validation_config = field.get("validation", {})

        # Check required fields
        if required and (value is None or value == ""):
            error_msg = validation_config.get("error_message", f"{field_id} is required")
            errors.append(ValidationError(field_id, error_msg))
            return errors

        # Skip validation if not required and no value provided
        if not required and (value is None or value == ""):
            return errors

        # Type-specific validation
        if field_type == "text":
            errors.extend(self._validate_text(field_id, value, validation_config))
        elif field_type == "textarea":
            errors.extend(self._validate_text(field_id, value, validation_config))
        elif field_type == "number":
            errors.extend(self._validate_number(field_id, value, validation_config))
        elif field_type == "date":
            errors.extend(self._validate_date(field_id, value, validation_config))
        elif field_type == "select":
            errors.extend(self._validate_enum(field_id, value, field, validation_config))

        return errors

    def _validate_text(self, field_id: str, value: Any, config: Dict[str, Any]) -> List[ValidationError]:
        """Validate text field."""
        errors: List[ValidationError] = []

        if not isinstance(value, str):
            error_msg = config.get("error_message", f"{field_id} must be a string")
            errors.append(ValidationError(field_id, error_msg))
            return errors

        min_length = config.get("min_length", 0)
        max_length = config.get("max_length", 5000)

        if len(value) < min_length:
            error_msg = f"{field_id} must be at least {min_length} characters"
            errors.append(ValidationError(field_id, error_msg))

        if len(value) > max_length:
            error_msg = config.get("error_message", f"{field_id} must not exceed {max_length} characters")
            errors.append(ValidationError(field_id, error_msg))

        if config.get("format") == "email" and value:
            if not self.EMAIL_PATTERN.match(value.strip()):
                errors.append(ValidationError(field_id, f"{field_id} must be a valid email address"))

        return errors

    def _validate_number(self, field_id: str, value: Any, config: Dict[str, Any]) -> List[ValidationError]:
        """Validate numeric field."""
        errors: List[ValidationError] = []

        try:
            num_value = float(value)
        except (ValueError, TypeError):
            error_msg = config.get("error_message", f"{field_id} must be a valid number")
            errors.append(ValidationError(field_id, error_msg))
            return errors

        min_value = config.get("min_value")
        max_value = config.get("max_value")

        if min_value is not None and num_value < min_value:
            error_msg = f"{field_id} must be at least {min_value}"
            errors.append(ValidationError(field_id, error_msg))

        if max_value is not None and num_value > max_value:
            error_msg = f"{field_id} must not exceed {max_value}"
            errors.append(ValidationError(field_id, error_msg))

        return errors

    def _validate_date(self, field_id: str, value: Any, config: Dict[str, Any]) -> List[ValidationError]:
        """Validate date field."""
        errors: List[ValidationError] = []
        date_format = config.get("format", "YYYY-MM-DD")

        try:
            if isinstance(value, str):
                parsed_date = datetime.strptime(value, "%Y-%m-%d")
            else:
                parsed_date = value
        except (ValueError, TypeError):
            error_msg = config.get("error_message", f"{field_id} must be a valid date in format {date_format}")
            errors.append(ValidationError(field_id, error_msg))
            return errors

        # Check if date must be in future
        if config.get("future_only", False):
            if parsed_date <= datetime.now():
                error_msg = config.get("error_message", f"{field_id} must be a future date")
                errors.append(ValidationError(field_id, error_msg))

        return errors

    def _validate_enum(self, field_id: str, value: Any, field: Dict[str, Any], 
                      config: Dict[str, Any]) -> List[ValidationError]:
        """Validate enum/select field."""
        errors: List[ValidationError] = []
        lov_source = field.get("lov_source")
        if lov_source and isinstance(self.lovs.get(lov_source), list):
            allowed_values = self.lovs.get(lov_source, [])
        else:
            allowed_values = config.get("allowed_values", [])

        # Multi-select values may arrive as a list or as a comma-separated string.
        if field.get("multi_select"):
            if isinstance(value, (list, tuple, set)):
                selected_values = [str(item).strip() for item in value if str(item).strip()]
            elif isinstance(value, str):
                selected_values = [item.strip() for item in value.split(",") if item.strip()]
            else:
                selected_values = [str(value).strip()] if str(value).strip() else []
            invalid_values = [item for item in selected_values if item not in allowed_values]
            if invalid_values:
                error_msg = f"{field_id} contains invalid values: {', '.join(invalid_values)}"
                errors.append(ValidationError(field_id, error_msg))
            return errors

        if value not in allowed_values:
            error_msg = config.get("error_message", f"{field_id} must be one of: {', '.join(allowed_values)}")
            errors.append(ValidationError(field_id, error_msg))

        return errors

    def _validate_cross_field_rules(self, data: Dict[str, Any]) -> List[ValidationError]:
        """
        Validate rules that span multiple fields.
        
        Args:
            data: Form data dictionary
            
        Returns:
            List of validation errors
        """
        errors: List[ValidationError] = []

        # Rule: adjusted_end_date should be >= estd_end_date (if both provided)
        estd_date = data.get("estd_end_date")
        adj_date = data.get("adjusted_end_date")

        if estd_date and adj_date:
            try:
                estd = datetime.strptime(estd_date, "%Y-%m-%d") if isinstance(estd_date, str) else estd_date
                adj = datetime.strptime(adj_date, "%Y-%m-%d") if isinstance(adj_date, str) else adj_date
                
                if adj < estd:
                    errors.append(ValidationError(
                        "adjusted_end_date",
                        "Adjusted End Date should be equal to or after Estd. End Date"
                    ))
            except (ValueError, TypeError):
                pass  # Date validation errors already captured

        # Rule: Category is required if State == "Funnel"
        state = data.get("state")
        category = data.get("category")
        project_status = data.get("project_status")
        project_otd_status = data.get("project_otd_status")
        project_otd_phase = data.get("project_otd_phase")
        
        if state == "Funnel" and not category:
            errors.append(ValidationError(
                "category",
                "Category is required when State is 'Funnel'"
            ))

        if state in ["Funnel", "Evaluation", "Hold"] and project_otd_status not in [None, ""]:
            errors.append(ValidationError(
                "project_otd_status",
                "OTD Status must be blank when State is Funnel, Evaluation, or Hold"
            ))

        if state == "Active" and not project_otd_status:
            errors.append(ValidationError(
                "project_otd_status",
                "OTD Status is required when State is Active"
            ))

        if not project_otd_phase:
            errors.append(ValidationError(
                "project_otd_phase",
                "Phase is required"
            ))

        normalized_otd = str(project_otd_status or "").strip().lower().replace("-", " ")
        if normalized_otd == "adjusted plan" and not adj_date:
            errors.append(ValidationError(
                "adjusted_end_date",
                "Adjusted End Date is required when OTD Status is 'Adjusted Plan'"
            ))

        if normalized_otd in ["on track", "slip"] and not estd_date:
            errors.append(ValidationError(
                "estd_end_date",
                "Actual End Date is required when OTD Status is 'On Track' or 'Off Track'"
            ))

        return errors

    def set_defaults(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply default values to form data.
        
        Args:
            data: Form data dictionary
            
        Returns:
            Form data with defaults applied
        """
        result = data.copy()

        for field_id, default_value in self.defaults.items():
            if field_id not in result or result[field_id] is None:
                result[field_id] = default_value

        state = result.get("state")

        if state in ["Funnel", "Evaluation", "Hold", "Closure"]:
            result["project_status"] = ""

        if state == "Funnel" and ("project_otd_phase" not in result or result.get("project_otd_phase") in [None, ""]):
            result["project_otd_phase"] = "Discovery"

        return result

    def set_system_generated_values(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute and set system-generated field values.
        
        Args:
            data: Form data dictionary
            
        Returns:
            Form data with system-generated values set
        """
        result = data.copy()
        state = result.get("state")

        # OTD Status: null for Funnel/Evaluation/Hold; preserve user selection otherwise
        if state in ["Funnel", "Evaluation", "Hold"]:
            result["project_otd_status"] = None
        elif "project_otd_status" not in result or result.get("project_otd_status") is None:
            result["project_otd_status"] = ""

        # Adjusted End Date: blank by default unless user provides value
        if "adjusted_end_date" not in result or result.get("adjusted_end_date") is None:
            result["adjusted_end_date"] = ""

        normalized_otd = str(result.get("project_otd_status") or "").strip().lower().replace("-", " ")
        if normalized_otd != "adjusted plan":
            result["adjusted_end_date"] = ""

        # Filter Key: concatenation of dt_team_accountable + primary_function for search
        dt_team = result.get("dt_team_accountable", "")
        primary_func = result.get("primary_function", "")
        if "filter_key" not in result or result.get("filter_key") is None:
            result["filter_key"] = f"{dt_team}{primary_func}".strip()

        return result
