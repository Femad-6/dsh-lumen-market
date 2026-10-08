# Third-party notices

- Production dependency: semver 7.7.2, ISC license, https://github.com/npm/node-semver . Its license remains in the installed dependency package.
- Development-only React/ReactDOM (MIT), jsdom (MIT), esbuild (MIT), and their transitive dependencies are not bundled into the published plugin.
- Host compatibility decisions follow the public DeepSeek Harness plugin-manager/app-boot contract. The implementation in this package was written for this plugin; no dsh-compat-market implementation files were copied.
- Profile location, source protection and update-result behavior were informed by the sibling dsh-plugin-update-center implementation; it is not a runtime dependency.
