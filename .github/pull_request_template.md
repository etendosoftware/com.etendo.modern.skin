## Summary

<!-- What changes and why. Link the Jira task (ETP-XXXX). -->

## Screenshots

<!-- Before / after for every screen this touches. Say which preset (ETSKIN_Theme) and which
navigation mode (ETSKIN_Navigation) the screenshots use. Write "Not applicable" otherwise. -->

## Test plan

- [ ] Checked with the skin on (`ETSKIN_Enabled = Y`) and off (`N`: stock look, no leftovers)
- [ ] Checked with `ETSKIN_Navigation` = `sidebar` and `topbar` (if navigation is touched)
- [ ] No errors in the browser console after `smartbuild` and a hard reload
- [ ] JavaScript stays ES5 (it is concatenated into the global bundle and minified with JSMin)
- [ ] README updated if behaviour, configuration or a core hook changed
