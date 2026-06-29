# TODO

## Modern Conversion Pipeline

- [x] Inventory existing local changes, branches, submodules, and conversion flow.
- [x] Record current local tool versions and important constraints.
- [x] Add a one-command conversion/update pipeline.
- [x] Add exact provenance metadata for source assets, converter versions, commands, and output files.
- [x] Rebase or port `origin/guc` conversion support onto current `main`.
- [x] Update GUC discovery/configuration and run GUC conversions where the binary is available.
- [x] Verify Blender 5.1.2 conversion on representative sample assets.
- [x] Verify OpenUSD 26.05 plus Adobe glTF file-format plugin conversion on representative sample assets.
- [x] Verify three.js r185 conversion while preserving the existing r154 conversion set.
- [x] Run Blender 5.1.2 conversion across the full sample asset corpus and record pass/fail provenance.
- [x] Run OpenUSD + Adobe glTF conversion across the full sample asset corpus and record pass/fail provenance.
- [x] Run three.js r185 conversion across the full sample asset corpus and record pass/fail provenance.
- [x] Fix three.js r185 conversions to run in a real browser image/canvas environment so textures are exported.
- [x] Run GUC 0.5 conversion across the full sample asset corpus and record pass/fail provenance.
- [x] Run Needle Engine 5.1.2 conversion across the full sample asset corpus and record pass/fail provenance.
- [x] Add a headed Playwright runner for Needle Engine `USDZExporter`, including animation export settings.
- [x] Replace the temporary fake Needle export context with a real `<needle-engine>` runtime context.
- [x] Add or update sample-asset submodule(s) to use the latest Khronos assets.
- [x] Normalize thumbnail rendering settings across conversion families in the new conversion runner.
- [x] Rerender all successful USDZ thumbnails with the approved 35-degree FOV / HDR dome settings.
- [x] Update UI to show converter families, versions, provenance, previews, downloads, and viewer links dynamically.
- [x] Fix USD Web Viewer links to use the current page origin instead of hardcoded production file URLs.
- [x] Generate per-asset USD conversion analysis JSON with an overview index.
- [x] Store generated provenance and analysis JSON beside generated conversions in the sample-assets submodule.
- [x] Add per-asset feature survival table for source glTF versus available USDZ conversions.
- [x] Add a Playwright/three.js canonical glTF source reference render after finalizing USD thumbnail lighting/framing.
- [x] Fix glTF reference transmissive ordering, USD thumbnail clip ranges, and USD dome X orientation after visual regression checks.
- [x] Validate glTF reference environment alignment against an Adobe/OpenUSD USDZ chrome sphere: no mirror, HDR `flipY=true`, Y rotation 270 degrees.
- [x] Convert generated preview/reference images to WebP q90 and update generation scripts to keep WebP as the final artifact.
- [x] Centralize USD thumbnail rendering so conversion-time renders and standalone rerenders share one helper/settings path.
- [x] Regenerate Needle Engine conversions and WebP thumbnails with `quickLookCompatible=false`.
- [x] Make the one-command conversion runner provenance-aware by default, with `--force` for intentional reruns.
- [x] Wire USD-WG assets from the hosted Needle asset index into the homepage collection, then disable the app inclusion pending a better product decision.
- [x] Add expandable collection/subcategory navigation for glTF and USD-WG assets.
- [x] Add Kitchen Set as a Needle-hosted USD-WG entry with the requested subheadline.
- [x] Add multiplicative include/exclude filters for asset groups and capabilities.
- [x] Verify representative conversion run.
- [ ] Restore `npm run check` to green.
- [x] Verify production build with provenance-filtered static asset copying.

## Follow-Up Hygiene

- [ ] Decide whether old generated artifacts should stay in the existing `glTF-Sample-Models` submodule or move to a versioned output directory.
- [ ] Decide where large generated output should live long-term if multiple conversion generations accumulate.
- [x] Free enough disk space for the full conversion corpus and static build copy.
