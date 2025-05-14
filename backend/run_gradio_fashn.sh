#!/bin/bash

# Run the Gradio interface for FASHN.ai API testing
echo "Starting Gradio interface for FASHN.ai API testing..."
python -m gradio_interface

# If you need to add an API key directly, uncomment and modify:
# FASHN_API_KEY="your_api_key_here" python -m gradio_interface

echo "Done!" 