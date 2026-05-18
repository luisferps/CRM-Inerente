3:04:35 AM: build-image version: ac6eb13fbf000e5c09ad677efd8b7c3c2d0142b6 (noble-new-builds)
3:04:35 AM: buildbot version: de14d13d022c18f089944497bd804e269fc4f82f
3:04:35 AM: Building with cache
3:04:35 AM: Starting to prepare the repo for build
3:04:35 AM: Preparing Git Reference refs/heads/main
3:04:37 AM: Installing dependencies
3:04:37 AM: mise ~/.config/mise/config.toml tools: python@3.14.3
3:04:37 AM: mise ~/.config/mise/config.toml tools: ruby@3.4.8
3:04:37 AM: mise ~/.config/mise/config.toml tools: go@1.26.2
3:04:37 AM: v22.22.3 is already installed.
3:04:38 AM: Now using node v22.22.3 (npm v10.9.8)
3:04:38 AM: Enabling Node.js Corepack
3:04:38 AM: No npm workspaces detected
3:04:38 AM: Installing npm packages using npm version 10.9.8
3:04:40 AM: up to date in 1s
3:04:40 AM: npm packages installed
3:04:40 AM: Successfully installed dependencies
3:04:40 AM: Detected 1 framework(s)
3:04:40 AM: "create-react-app" at version "5.0.1"
3:04:40 AM: Starting build script
3:04:43 AM: Section completed: initializing
3:04:45 AM: ​
3:04:45 AM: Netlify Build                                                 
3:04:45 AM: ────────────────────────────────────────────────────────────────
3:04:45 AM: ​
3:04:45 AM: ❯ Version
3:04:45 AM:   @netlify/build 35.13.4
3:04:45 AM: ​
3:04:45 AM: ❯ Flags
3:04:45 AM:   accountId: 6a04edb18fba391270884cff
3:04:45 AM:   baseRelDir: true
3:04:45 AM:   buildId: 6a0aabe6ca989f0008b45e01
3:04:45 AM:   deployId: 6a0aabe6ca989f0008b45e03
3:04:45 AM: ​
3:04:45 AM: ❯ Current directory
3:04:45 AM:   /opt/build/repo
3:04:45 AM: ​
3:04:45 AM: ❯ Config file
3:04:45 AM:   /opt/build/repo/netlify.toml
3:04:45 AM: ​
3:04:45 AM: ❯ Context
3:04:45 AM:   production
3:04:45 AM: ​
3:04:45 AM: build.command from netlify.toml                               
3:04:45 AM: ────────────────────────────────────────────────────────────────
3:04:45 AM: ​
3:04:45 AM: $ npm run build
3:04:45 AM: > crm-imobiliario@1.0.0 build
3:04:45 AM: > react-scripts build
3:04:47 AM: Creating an optimized production build...
3:04:56 AM: Failed to compile.
3:04:56 AM: 
3:04:56 AM: Attempted import error: 'ETAPAS_FUNIL' is not exported from '../constants' (imported as 'ETAPAS_FUNIL').
3:04:56 AM: ​
3:04:56 AM: "build.command" failed                                        
3:04:56 AM: ────────────────────────────────────────────────────────────────
3:04:56 AM: ​
3:04:56 AM:   Error message
3:04:56 AM:   Command failed with exit code 1: npm run build (https://ntl.fyi/exit-code-1)
3:04:56 AM: ​
3:04:56 AM:   Error location
3:04:56 AM:   In build.command from netlify.toml:
3:04:56 AM:   npm run build
3:04:56 AM: ​
3:04:56 AM:   Resolved config
3:04:56 AM:   build:
3:04:56 AM:     command: npm run build
3:04:56 AM:     commandOrigin: config
3:04:56 AM:     environment:
3:04:56 AM:       - REACT_APP_SUPABASE_ANON_KEY
3:04:56 AM:       - REACT_APP_SUPABASE_URL
3:04:56 AM:     publish: /opt/build/repo/build
3:04:56 AM:     publishOrigin: config
3:04:56 AM:   redirects:
3:04:56 AM:     - from: /*
      status: 200
      to: /index.html
  redirectsOrigin: config
3:04:56 AM: Build failed due to a user error: Build script returned non-zero exit code: 2
3:04:57 AM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
3:04:57 AM: Failing build: Failed to build site
3:04:57 AM: Finished processing build request in 21.996s
