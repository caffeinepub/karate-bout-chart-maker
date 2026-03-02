# Karate Kumite Bout Chart Maker

## Current State
The app has a working karate bout chart system with:
- Backend: Motoko with Division, Competitor, and Bout types; bracket generation; result recording
- Frontend: Sidebar with division list, DivisionView with bracket display, add-competitor forms, export to Excel
- Divisions are manually created; competitors are manually added one by one
- Weight categories exist as a field but are not used to auto-group competitors into divisions

## Requested Changes (Diff)

### Add
- **Excel import feature**: Upload an .xlsx or .csv file containing competitor data. The file columns should include: Name, Dojo/Club, Belt Rank, Weight (kg), Gender, Age Category (optional)
- **Auto-grouping by weight category**: After import, parse rows and automatically group competitors into divisions by weight class (e.g. Under 50kg, 50-55kg, 55-60kg, 60-67kg, 67-75kg, 75+kg) and optionally by gender/age
- **Import preview screen**: Show parsed competitors grouped by detected weight category before confirming the import
- **Batch addCompetitor calls**: On confirm, bulk-add all competitors to their respective auto-created divisions
- **Excel template download**: A "Download Template" button that gives users a sample .xlsx file showing the correct column structure
- **Per-weight-category bout chart generation**: Generate a bracket for each weight category division after import

### Modify
- **App layout**: Add an "Import from Excel" button prominently in the sidebar or header
- **Sidebar**: Show import status/progress indicator while bulk import is in progress
- **DivisionView**: After import, auto-select the first imported division

### Remove
- Nothing removed; existing manual-add flow remains available

## Implementation Plan
1. Add `xlsx` (SheetJS) npm package to frontend for reading .xlsx files
2. Build `ExcelImporter` component:
   - File drag-and-drop + file picker (accepts .xlsx, .xls, .csv)
   - Parse file using SheetJS, map columns: Name, Club/Dojo, Belt, Weight(kg), Gender, Age
   - Auto-detect weight category buckets from the weight values
   - Show preview table grouped by weight category
   - "Download Template" button that generates a sample xlsx
   - Confirm button triggers batch backend calls: createDivision per weight group, addCompetitor per row
3. Wire ExcelImporter into App.tsx via a modal/dialog triggered from the sidebar
4. After successful import, refresh divisions list and auto-select first new division
5. Auto-trigger generateBracket for each newly created division
