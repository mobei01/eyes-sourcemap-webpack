<div align="center">
  <h1>eyes-sourcemap-webpack</h1> <p>A webpack plugin for uploading source maps during build processes, supporting error tracking and debugging in production.</p>
</div>

📋 Introduction

eyes-sourcemap-webpack is a powerful webpack plugin that automatically uploads source maps at build time, enabling efficient debugging and error tracking. It executes after the build process, before the final output of the dist folder.



🚀 Installation

Install the plugin via npm:

```bash
npm install eyes-sourcemap-webpack --save-dev
```

⚙️ Configuration

Below is an example of how to configure the plugin in your vue.config.js:

```bash
// vue.config.js
const EyesSourceMap = require('eyes-sourcemap-webpack');

module.exports = defineConfig({
  productionSourceMap: true,
  configureWebpack: {
    plugins: [
      new EyesSourceMap({
        dsn: 'http://your-upload-url', // Required: API base URL for uploads
        token: 'your-project-token',   // Required: Unique project identifier
        uploadScript: ['vue-cli-service build --mode staging'], // Optional: Commands triggering upload
        productionSourceMap: true,     // Optional: Retain source maps (default: false)
        concurrency: 6,                 // Optional: Max upload concurrency (default: 5)
        api: '/api/upload/sourcemap'   // Optional: API endpoint for uploads (default: /api/upload/sourcemap)
      })
    ]
  }
})
```

🎯 When to Use This Plugin?

Production Error Tracking: Upload source maps to your monitoring service for better stack traces in production.
Efficient Debugging: Retain hidden source maps to debug production issues without exposing code to end-users.

📝 Changelog

v1.0.2

Initial release of the plugin.
Support for concurrent uploads with customizable limits.
