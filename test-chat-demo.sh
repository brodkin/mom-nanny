#!/bin/bash

# Test the text-chat CLI with a quick demo

echo "Testing text-chat CLI..."
echo ""
echo "Commands to test:"
echo "  1. Send a message: 'Hello'"
echo "  2. Toggle debug: '/debug'"
echo "  3. Show stats: '/stats'"
echo "  4. Exit: '/exit'"
echo ""

# Create a test input file
cat > test-input.txt << EOF
Hello
/stats
/debug
Where is Ryan?
/debug
/stats
/exit
EOF

echo "Running demo..."
echo ""

# Run the chat with test input
timeout 10 npm run chat < test-input.txt || true

echo ""
echo "Demo complete!"

# Clean up
rm -f test-input.txt