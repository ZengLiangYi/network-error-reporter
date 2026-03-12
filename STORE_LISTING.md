# Chrome Web Store Listing

## Name

Network Error Reporter

## Summary

Generate structured network incident reports directly from Chrome DevTools.

## Single purpose

Generate structured network incident reports from Chrome DevTools for frontend and backend debugging.

## Category suggestion

Developer Tools

## Detailed description

Network Error Reporter helps frontend engineers turn failed network requests into structured bug reports without manually filling templates.

Open Chrome DevTools, switch to the `Error Report` panel, pick a failed request, and the extension will generate a readable report with:

- environment info
- request URL, method, status code, and response time
- extracted request and response headers with emphasis on custom tracing or auth fields
- query params, request payload, and response summary
- editable impact scope, frequency, and reproduction notes
- one-click Markdown copy
- image export for easy sharing in chat tools

This extension is designed for day-to-day collaboration between frontend and backend engineers when debugging API failures.

## Important usage note

This is a Chrome DevTools extension. It does not add a normal browser toolbar workflow.  
After installation, open any page's DevTools and switch to the `Error Report` panel.

## Privacy statement

Network Error Reporter processes request data locally inside the browser extension context. It does not upload request data to a remote server.

## Support

Recommended support URL:

- GitHub Issues page for this repository
