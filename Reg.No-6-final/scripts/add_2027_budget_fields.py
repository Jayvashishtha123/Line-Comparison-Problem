"""Script to add budget_2027_flag and benefits_plan_2027 fields to all projects."""

import json
from pathlib import Path

def add_2027_budget_fields():
    """Add 2027 budget fields to portfolio.json"""
    data_dir = Path(__file__).parent.parent / "data"
    portfolio_file = data_dir / "portfolio.json"
    
    if not portfolio_file.exists():
        print(f"Error: {portfolio_file} not found")
        return
    
    # Load portfolio
    with open(portfolio_file, 'r', encoding='utf-8') as f:
        portfolio = json.load(f)
    
    # Update each project
    updated_count = 0
    for project in portfolio.get('projects', []):
        if 'budget_2027_flag' not in project:
            project['budget_2027_flag'] = ''
            updated_count += 1
        if 'benefits_plan_2027' not in project:
            project['benefits_plan_2027'] = ''
            updated_count += 1
    
    # Save updated portfolio
    with open(portfolio_file, 'w', encoding='utf-8') as f:
        json.dump(portfolio, f, indent=2)
    
    print(f"✓ Added 2027 budget fields to {len(portfolio.get('projects', []))} projects")
    print(f"✓ Total fields added: {updated_count}")
    
    # Also update portfolio_dummy.json if it exists
    dummy_file = data_dir / "portfolio_dummy.json"
    if dummy_file.exists():
        with open(dummy_file, 'r', encoding='utf-8') as f:
            dummy = json.load(f)
        
        for project in dummy.get('projects', []):
            if 'budget_2027_flag' not in project:
                project['budget_2027_flag'] = ''
            if 'benefits_plan_2027' not in project:
                project['benefits_plan_2027'] = ''
        
        with open(dummy_file, 'w', encoding='utf-8') as f:
            json.dump(dummy, f, indent=2)
        
        print(f"✓ Updated portfolio_dummy.json")

if __name__ == '__main__':
    add_2027_budget_fields()
