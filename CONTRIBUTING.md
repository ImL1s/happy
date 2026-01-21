# Contributing to Happy

## Development Workflow: Build Variants

The Happy app supports three build variants across **iOS, Android, and macOS desktop**, each with separate bundle IDs so all three can be installed simultaneously:

| Variant | Bundle ID | App Name | Use Case |
|---------|-----------|----------|----------|
| **Development** | `com.slopus.happy.dev` | Happy (dev) | Local development with hot reload |
| **Preview** | `com.slopus.happy.preview` | Happy (preview) | Beta testing & OTA updates before production |
| **Production** | `com.ex3ndr.happy` | Happy | Public App Store release |

**Why Preview?**
- **Development**: Fast iteration, dev server, instant reload
- **Preview**: Beta testers get OTA updates (`eas update --branch preview`) without app store submission
- **Production**: Stable App Store builds

This allows you to test production-like builds with real users before releasing to the App Store.

## Quick Start

### iOS Development

```bash
# Development variant (default)
npm run ios:dev

# Preview variant
npm run ios:preview

# Production variant
npm run ios:production
```

### Android Development

```bash
# Development variant
npm run android:dev

# Preview variant
npm run android:preview

# Production variant
npm run android:production
```

### macOS Desktop (Tauri)

```bash
# Development variant - run with hot reload
npm run tauri:dev

# Build development variant
npm run tauri:build:dev

# Build preview variant
npm run tauri:build:preview

# Build production variant
npm run tauri:build:production
```

**How Tauri Variants Work:**
- Base config: `src-tauri/tauri.conf.json` (production defaults)
- Partial configs: `tauri.dev.conf.json`, `tauri.preview.conf.json`
- Tauri merges partial configs using [JSON Merge Patch (RFC 7396)](https://datatracker.ietf.org/doc/html/rfc7396)
- Only differences need to be specified in partial configs (DRY principle)

### Development Server

```bash
# Start dev server for development variant
npm run start:dev

# Start dev server for preview variant
npm run start:preview

# Start dev server for production variant
npm run start:production
```

## Visual Differences

Each variant displays a different app name on your device:
- **Development**: "Happy (dev)" - Yellow/orange theme
- **Preview**: "Happy (preview)" - Preview theme
- **Production**: "Happy" - Standard theme

This makes it easy to distinguish which version you're testing!

## Common Workflows

### Testing Development Changes

1. **Build development variant:**
   ```bash
   npm run ios:dev
   ```

2. **Make your changes** to the code

3. **Hot reload** automatically updates the app

4. **Rebuild if needed** for native changes:
   ```bash
   npm run ios:dev
   ```

### Testing Preview (Pre-Release)

1. **Build preview variant:**
   ```bash
   npm run ios:preview
   ```

2. **Test OTA updates:**
   ```bash
   npm run ota  # Publishes to preview branch
   ```

3. **Verify** the preview build works as expected

### Production Release

1. **Build production variant:**
   ```bash
   npm run ios:production
   ```

2. **Submit to App Store:**
   ```bash
   npm run submit
   ```

3. **Deploy OTA updates:**
   ```bash
   npm run ota:production
   ```

## All Variants Simultaneously

You can install all three variants on the same device:

```bash
# Build all three variants
npm run ios:dev
npm run ios:preview
npm run ios:production
```

All three apps appear on your device with different icons and names!

## EAS Build Profiles

The project includes EAS build profiles for automated builds:

```bash
# Development build
eas build --profile development

# Production build
eas build --profile production
```

## Environment Variables

Each variant can use different environment variables via `APP_ENV`:

```javascript
// In app.config.js
const variant = process.env.APP_ENV || 'development';
```

This controls:
- Bundle identifier
- App name
- Associated domains (deep linking)
- Intent filters (Android)
- Other variant-specific configuration

## Deep Linking

Only **production** variant has deep linking configured:

- **Production**: `https://app.happy.engineering/*`
- **Development**: No deep linking
- **Preview**: No deep linking

This prevents dev/preview builds from interfering with production deep links.

## Testing Connected to Different Servers

You can connect different variants to different Happy CLI instances:

```bash
# Development app → Dev CLI daemon
npm run android:dev
# Connect to CLI running: npm run dev:daemon:start

# Production app → Stable CLI daemon
npm run android:production
# Connect to CLI running: npm run stable:daemon:start
```

Each app maintains separate authentication and sessions!

## Local Server Development

To test with a local Happy server:

```bash
npm run start:local-server
```

This sets:
- `EXPO_PUBLIC_HAPPY_SERVER_URL=http://localhost:3005`
- `EXPO_PUBLIC_DEBUG=1`
- Debug logging enabled

## Troubleshooting

### Build fails with "Bundle identifier already in use"

This shouldn't happen - each variant has a unique bundle ID. If it does:

1. Check `app.config.js` - verify `bundleId` is set correctly for the variant
2. Clean build:
   ```bash
   npm run prebuild
   npm run ios:dev  # or whichever variant
   ```

### App not updating after changes

1. **For JS changes**: Hot reload should work automatically
2. **For native changes**: Rebuild the variant:
   ```bash
   npm run ios:dev  # Force rebuild
   ```
3. **For config changes**: Clean and prebuild:
   ```bash
   npm run prebuild
   npm run ios:dev
   ```

### All three apps look the same

Check the app name on the home screen:
- "Happy (dev)"
- "Happy (preview)"
- "Happy"

If they're all the same name, the variant might not be set correctly. Verify:

```bash
# Check what APP_ENV is set to
echo $APP_ENV

# Or look at the build output
npm run ios:dev  # Should show "Happy (dev)" as the name
```

### Connected device not found

For iOS connected device testing:

```bash
# List available devices
xcrun devicectl list devices

# Run on specific connected device
npm run ios:connected-device
```

## Tips

1. **Use development variant for active work** - Fast iteration, debug features enabled
2. **Use preview for pre-release testing** - Test OTA updates before production
3. **Use production for final validation** - Exact configuration that ships to users
4. **Install all three simultaneously** - Compare behaviors side-by-side
5. **Different CLI instances** - Connect dev app to dev CLI, prod app to stable CLI
6. **Check app name** - Always visible which variant you're testing

## How It Works

The `app.config.js` file reads the `APP_ENV` environment variable:

```javascript
const variant = process.env.APP_ENV || 'development';
const bundleId = {
  development: "com.slopus.happy.dev",
  preview: "com.slopus.happy.preview",
  production: "com.ex3ndr.happy"
}[variant];
```

The `cross-env` package ensures this works cross-platform:

```json
{
  "scripts": {
    "ios:dev": "cross-env APP_ENV=development expo run:ios"
  }
}
```

Cross-platform via `cross-env` - works identically on Windows, macOS, and Linux!

## Fork 維護與分支策略

這個 repo 是從 [slopus/happy](https://github.com/slopus/happy) fork 來的。我們需要長期維護自己的更改，同時保持與上游同步。

### 分支結構

```
upstream/main  ←────── 上游（slopus/happy）
     ↓ fetch
   main        ←────── 只追蹤上游（不要在這裡開發）
     ↓ merge/rebase
   dev         ←────── 我們的「主線」，包含所有本地更改
     ↓ branch
feature/xxx    ←────── 新功能開發
```

### 日常開發流程

```bash
# 1. 從 dev 創建 feature branch
git checkout dev
git checkout -b feature/my-new-feature

# 2. 開發完成後，直接 merge 到 dev（不需要開 PR）
git checkout dev
git merge feature/my-new-feature
git push origin dev

# 3. 刪除 feature branch
git branch -d feature/my-new-feature
```

### 同步上游更改

```bash
# 1. 拉取上游最新
git fetch upstream

# 2. 更新本地 main
git checkout main
git merge upstream/main
git push origin main

# 3. 把上游更改帶入 dev
git checkout dev
git rebase main        # 或 merge，看偏好
git push origin dev --force-with-lease  # 如果用 rebase
```

### 向上游提交 PR

如果某個功能想貢獻回上游：

```bash
# 從 main 創建乾淨的分支
git checkout main
git checkout -b pr/feature-for-upstream

# Cherry-pick 需要的 commits
git cherry-pick <commit-hash>

# Push 並到 GitHub 開 PR
git push origin pr/feature-for-upstream
# 然後到 GitHub 向 slopus/happy 開 PR
```

### 為什麼這樣設計？

| 分支 | 用途 |
|------|------|
| `main` | 乾淨追蹤上游，方便同步和提 PR |
| `dev` | 我們的主線，累積所有本地更改 |
| `feature/*` | 短期功能分支，開發完就刪 |
| `pr/*` | 專門用於向上游提 PR 的分支 |
