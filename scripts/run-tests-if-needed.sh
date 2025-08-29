#!/bin/bash

# Smart test runner for pre-commit hooks
# Runs Jest tests efficiently based on changed files

set -e

# Get all staged files
STAGED_FILES=$(git diff --cached --name-only)

# Check if we should force full test suite
if [[ "${FORCE_FULL_TEST}" == "1" ]]; then
  echo "🚀 FORCE_FULL_TEST=1 - Running full test suite..."
  npm test
  exit 0
fi

# Define patterns for files that don't need testing
DOC_PATTERNS=(
  "*.md"
  "*.txt" 
  "*.rst"
  "README*"
  "CHANGELOG*"
  "LICENSE*"
  "docs/"
  ".github/"
  ".vscode/"
  ".gitignore"
  ".env.*"
  "*.log"
)

# Define patterns for code files that need testing
CODE_PATTERNS=(
  "services/"
  "functions/" 
  "routes/"
  "middleware/"
  "app.js"
  "test/"
)

# Count code vs non-code files
CODE_FILES=()
NON_CODE_FILES=()

while IFS= read -r file; do
  if [[ -n "$file" ]]; then
    IS_CODE=false
    
    # Check if it's a code file
    for pattern in "${CODE_PATTERNS[@]}"; do
      if [[ "$file" == $pattern* ]]; then
        IS_CODE=true
        break
      fi
    done
    
    if [[ "$file" == *.js ]] && [[ "$IS_CODE" == true ]]; then
      CODE_FILES+=("$file")
    else
      # Check if it's a documentation file
      IS_DOC=false
      for pattern in "${DOC_PATTERNS[@]}"; do
        if [[ "$file" == $pattern* ]] || [[ "$file" == *"$pattern" ]]; then
          IS_DOC=true
          break
        fi
      done
      
      if [[ "$IS_DOC" == true ]]; then
        NON_CODE_FILES+=("$file")
      else
        # Other files (configs, etc.) - might need testing
        CODE_FILES+=("$file")
      fi
    fi
  fi
done <<< "$STAGED_FILES"

# Determine what to do
TOTAL_FILES=$((${#CODE_FILES[@]} + ${#NON_CODE_FILES[@]}))
CODE_COUNT=${#CODE_FILES[@]}
DOC_COUNT=${#NON_CODE_FILES[@]}

echo "📊 Commit analysis: $CODE_COUNT code files, $DOC_COUNT doc files"

# If only documentation files, skip tests
if [[ $CODE_COUNT -eq 0 ]] && [[ $DOC_COUNT -gt 0 ]]; then
  echo "📝 Documentation-only commit detected - skipping tests"
  echo "   Files: ${NON_CODE_FILES[*]}"
  exit 0
fi

# If we have code files, run targeted tests
if [[ $CODE_COUNT -gt 0 ]]; then
  # Filter to only .js files for Jest
  JS_FILES=()
  for file in "${CODE_FILES[@]}"; do
    if [[ "$file" == *.js ]] && [[ -f "$file" ]]; then
      JS_FILES+=("$file")
    fi
  done
  
  if [[ ${#JS_FILES[@]} -gt 0 ]]; then
    echo "🧪 Running tests for changed code files..."
    echo "   Files: ${JS_FILES[*]}"
    
    # Use Jest's findRelatedTests for efficiency
    jest --bail --findRelatedTests "${JS_FILES[@]}"
    
    echo "✅ Tests passed for changed files"
  else
    echo "📝 No JavaScript files need testing"
  fi
else
  echo "🤔 No files to analyze"
fi

echo "✅ Pre-commit tests completed successfully"