#!/bin/bash
# Default electron-builder steps (templates/linux/after-remove.tpl) and the ufw rule of after-install.sh.

# Delete the link to the binary
# update-alternatives --remove <name> <path>: 'path' must be the registered alternative binary,
# not the generic symlink — see https://man7.org/linux/man-pages/man1/update-alternatives.1.html
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove 'gutenberg' '/opt/Gutenberg/gutenberg'
else
    rm -f '/usr/bin/gutenberg'
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/gutenberg'

# Remove and unload apparmor profile.
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  # Unload the profile from the running kernel before deleting the file so the
  # policy is not left enforced until the next reboot.  Mirror the chroot guard
  # used in the after-install script — live AppArmor operations are not
  # meaningful inside a chroot.
  # https://wiki.debian.org/AppArmor/HowToUse
  if apparmor_status --enabled > /dev/null 2>&1; then
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --remove "$APPARMOR_PROFILE_DEST" || true
    fi
  fi
  rm -f "$APPARMOR_PROFILE_DEST"
fi
# Only on removal, not on upgrade.
case "$1" in
  remove|purge)
    if command -v ufw >/dev/null 2>&1; then
      ufw delete allow 8484/tcp >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
