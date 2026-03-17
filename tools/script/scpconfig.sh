#!/bin/bash

# --- Configuration ---
USERNAME="<your_username>" # Replace with your actual username on the server
SERVER_IP="<server_ip_address>" # Replace with the actual IP address of the server
REMOTE_BASE_DIR="/DATA/shared" # The folder where these files live on the server

# --- Logic ---
# Check if the correct number of arguments is provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <files_separated_by_comma> <local_destination>"
    echo "Example: $0 keys1,keys2 ."
    exit 1
fi

FILES_INPUT=$1
LOCAL_DEST=$2

# Create the local destination if it doesn't exist
mkdir -p "$LOCAL_DEST"

# Convert comma-separated string into an array
IFS=',' read -ra ADDR <<< "$FILES_INPUT"

echo "Connecting to $SERVER_IP..."

# Loop through each file/folder name provided in the arguments
for FILE in "${ADDR[@]}"; do
    REMOTE_PATH="${REMOTE_BASE_DIR}${FILE}"
    
    echo "--> Fetching: $FILE"
    
    # Use -r to handle both single files and directories
    scp -r "$USERNAME@$SERVER_IP:$REMOTE_PATH" "$LOCAL_DEST"
done

echo "Done! Files saved to $LOCAL_DEST"
