# FASHN API v1.5 Migration Guide

## Overview

FASHN API is transitioning from v1 to v1.5 on **April 21, 2025**. This update brings:

- Improved output quality
- ~2x faster processing times (~6 seconds)
- Simplified controls
- Higher accuracy try-ons

## What Changed

### Backend Changes

1. Deprecated parameters (these will be ignored but still accepted for backward compatibility):
   - `adjust_hands`
   - `cover_feet`
   - `restore_background`
   - `restore_clothes`
   - `long_top`

2. Added new parameter:
   - `segmentation_free` - Improves fit accuracy but occasionally might not fully remove existing garments

3. Updated API endpoints in:
   - `routes/virtual_tryon.py`
   - Test HTML files

### Backward Compatibility

The backend implementation has been updated to maintain compatibility with existing frontend code:
1. Our endpoints will continue to **accept** the deprecated parameters to avoid breaking changes in the frontend
2. These parameters will be **ignored** in the actual requests to the FASHN API
3. The new `segmentation_free` parameter is added with a default value of `true`

**No frontend code changes are required** - existing applications will continue to work with the new backend.

## API Compatibility

To maintain backward compatibility with previous v1 behavior:
- Set `mode: "balanced"` 
- Set `segmentation_free: false`

This configuration ensures identical or improved results compared to v1, with faster processing.

## Default Behavior

By default, `segmentation_free` is enabled (`true`), which significantly enhances fit accuracy. However, in some cases, it may fail to fully remove original garments. If garment removal is critical for your use case, explicitly set `segmentation_free: false`.

## Upcoming Improvements

In approximately three weeks, a major upgrade will be released that improves output resolution to around 1MP range. This update will also provide better support for various aspect ratios including:
- 1:1 (square)
- 4:3 (wide)

## Testing

Please test thoroughly with different model and garment combinations to ensure the updated parameters work correctly in your environment.

## Questions?

Contact the FASHN team for support or clarification about these changes. 