1:08:09 PM: build-image version: ac6eb13fbf000e5c09ad677efd8b7c3c2d0142b6 (noble-new-builds)
1:08:09 PM: buildbot version: de14d13d022c18f089944497bd804e269fc4f82f
1:08:09 PM: Fetching cached dependencies
1:08:10 PM: Starting to download cache of 45.2MB (Last modified: 2026-05-18 23:19:08 +0000 UTC)
1:08:10 PM: Downloaded cache in 331ms
1:08:11 PM: Extracted cache in 1.297s
1:08:11 PM: Fetched cache in 1.708s
1:08:11 PM: Starting to prepare the repo for build
1:08:11 PM: Preparing Git Reference refs/heads/main
1:08:13 PM: Installing dependencies
1:08:13 PM: mise ~/.config/mise/config.toml tools: python@3.14.3
1:08:13 PM: mise ~/.config/mise/config.toml tools: ruby@3.4.8
1:08:13 PM: mise ~/.config/mise/config.toml tools: go@1.26.2
1:08:14 PM: Downloading and installing node v22.22.3...
1:08:14 PM: Downloading https://nodejs.org/dist/v22.22.3/node-v22.22.3-linux-x64.tar.xz...
1:08:14 PM: Computing checksum with sha256sum
1:08:14 PM: Checksums matched!
1:08:17 PM: Now using node v22.22.3 (npm v10.9.8)
1:08:17 PM: Enabling Node.js Corepack
1:08:17 PM: No npm workspaces detected
1:08:17 PM: Installing npm packages using npm version 10.9.8
1:08:18 PM: up to date in 959ms
1:08:18 PM: npm packages installed
1:08:18 PM: Successfully installed dependencies
1:08:18 PM: Detected 1 framework(s)
1:08:18 PM: "create-react-app" at version "5.0.1"
1:08:19 PM: Starting build script
1:08:19 PM: Section completed: initializing
1:08:21 PM: ​
1:08:21 PM: Netlify Build                                                 
1:08:21 PM: ────────────────────────────────────────────────────────────────
1:08:21 PM: ​
1:08:21 PM: ❯ Version
1:08:21 PM:   @netlify/build 35.13.4
1:08:21 PM: ​
1:08:21 PM: ❯ Flags
1:08:21 PM:   accountId: 6a04edb18fba391270884cff
1:08:21 PM:   baseRelDir: true
1:08:21 PM:   buildId: 6a0c8abcbac03e00082c9ed0
1:08:21 PM:   deployId: 6a0c8abcbac03e00082c9ed2
1:08:21 PM: ​
1:08:21 PM: ❯ Current directory
1:08:21 PM:   /opt/build/repo
1:08:21 PM: ​
1:08:21 PM: ❯ Config file
1:08:21 PM:   /opt/build/repo/netlify.toml
1:08:21 PM: ​
1:08:21 PM: ❯ Context
1:08:21 PM:   production
1:08:21 PM: ​
1:08:21 PM: build.command from netlify.toml                               
1:08:21 PM: ────────────────────────────────────────────────────────────────
1:08:21 PM: ​
1:08:21 PM: $ npm run build
1:08:21 PM: > crm-imobiliario@1.0.0 build
1:08:21 PM: > react-scripts build
1:08:22 PM: Creating an optimized production build...
1:08:32 PM: Failed to compile.
1:08:32 PM: 
1:08:32 PM: SyntaxError: /opt/build/repo/src/components/ClientesTab.js: 'return' outside of function. (73:2)
1:08:32 PM:   71 |   }
1:08:32 PM:   72 |
1:08:32 PM: > 73 |   return (
1:08:32 PM:      |   ^
1:08:32 PM:   74 |     <div>
1:08:32 PM:   75 |       <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
1:08:32 PM:   76 |         <div>
1:08:32 PM:     at parser.next (<anonymous>)
1:08:32 PM:     at normalizeFile.next (<anonymous>)
1:08:32 PM:     at run.next (<anonymous>)
1:08:32 PM:     at transform.next (<anonymous>)
1:08:32 PM: ​
1:08:32 PM: "build.command" failed                                        
1:08:32 PM: ────────────────────────────────────────────────────────────────
1:08:32 PM: ​
1:08:32 PM:   Error message
1:08:32 PM:   Command failed with exit code 1: npm run build (https://ntl.fyi/exit-code-1)
1:08:32 PM: ​
1:08:32 PM:   Error location
1:08:32 PM:   In build.command from netlify.toml:
1:08:32 PM:   npm run build
1:08:32 PM: ​
1:08:32 PM:   Resolved config
1:08:32 PM:   build:
1:08:32 PM:     command: npm run build
1:08:32 PM:     commandOrigin: config
1:08:32 PM:     environment:
1:08:32 PM:       - REACT_APP_SUPABASE_ANON_KEY
1:08:32 PM:       - REACT_APP_SUPABASE_URL
1:08:32 PM:     publish: /opt/build/repo/build
1:08:32 PM:     publishOrigin: config
1:08:32 PM:   redirects:
1:08:32 PM:     - from: /*
      status: 200
      to: /index.html
  redirectsOrigin: config
1:08:32 PM: Build failed due to a user error: Build script returned non-zero exit code: 2
1:08:32 PM: Failing build: Failed to build site
1:08:33 PM: Finished processing build request in 23.295s
1:08:32 PM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
