#!/usr/bin/env python3
"""
Helper script to setup Cloudinary for virtual try-on image processing
"""

import os
import sys
import argparse
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Setup Cloudinary for virtual try-on')
    parser.add_argument('--cloud-name', type=str, help='Cloudinary cloud name')
    parser.add_argument('--api-key', type=str, help='Cloudinary API key')
    parser.add_argument('--api-secret', type=str, help='Cloudinary API secret')
    parser.add_argument('--enable', action='store_true', help='Enable Cloudinary integration')
    parser.add_argument('--disable', action='store_true', help='Disable Cloudinary integration')
    parser.add_argument('--env-file', type=str, default='.env', help='Path to .env file')
    
    args = parser.parse_args()
    
    # Check if enable and disable flags are conflicting
    if args.enable and args.disable:
        print("Error: Cannot use both --enable and --disable flags")
        sys.exit(1)
    
    # Find the .env file
    env_file = Path(args.env_file)
    if not env_file.is_file():
        print(f"Warning: Environment file {env_file} not found. Creating new file.")
        env_file.touch()
    
    # Read existing .env file
    env_vars = {}
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    
    # Update with new values if provided
    changed = False
    if args.cloud_name:
        env_vars['CLOUDINARY_CLOUD_NAME'] = args.cloud_name
        changed = True
        print(f"Set CLOUDINARY_CLOUD_NAME to {args.cloud_name}")
        
    if args.api_key:
        env_vars['CLOUDINARY_API_KEY'] = args.api_key
        changed = True
        print(f"Set CLOUDINARY_API_KEY to {args.api_key}")
        
    if args.api_secret:
        env_vars['CLOUDINARY_API_SECRET'] = args.api_secret
        changed = True
        print(f"Set CLOUDINARY_API_SECRET to {args.api_secret}")
    
    # Update the enabled flag
    if args.enable:
        env_vars['USE_CLOUDINARY_FOR_TRYON'] = 'true'
        changed = True
        print("Enabled Cloudinary for virtual try-on")
    elif args.disable:
        env_vars['USE_CLOUDINARY_FOR_TRYON'] = 'false'
        changed = True
        print("Disabled Cloudinary for virtual try-on")
    
    # Write the updated .env file if changes were made
    if changed:
        with open(env_file, 'w') as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        print(f"Updated {env_file} with new settings")
    else:
        print("No changes made. Use --help to see available options.")
    
    # Check if all required variables are set
    if 'CLOUDINARY_CLOUD_NAME' in env_vars and 'CLOUDINARY_API_KEY' in env_vars and 'CLOUDINARY_API_SECRET' in env_vars:
        if env_vars.get('USE_CLOUDINARY_FOR_TRYON') == 'true':
            print("\nCloudinary configuration is complete and enabled.")
            print("The try-on process will now use Cloudinary for temporary image storage.")
        else:
            print("\nCloudinary is configured but currently disabled.")
            print("Run this script with --enable to activate it.")
    else:
        missing = []
        if 'CLOUDINARY_CLOUD_NAME' not in env_vars:
            missing.append('--cloud-name')
        if 'CLOUDINARY_API_KEY' not in env_vars:
            missing.append('--api-key')
        if 'CLOUDINARY_API_SECRET' not in env_vars:
            missing.append('--api-secret')
            
        if missing:
            print("\nCloudinary configuration is incomplete. Missing values:")
            for param in missing:
                print(f"  - {param}")
            print("\nRun this script with the missing parameters to complete setup.")

if __name__ == "__main__":
    main() 