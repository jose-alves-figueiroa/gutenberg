; Windows firewall rule for Gutenberg (PLAN.md → US8.2): OBS on another computer reads the
; overlay over HTTP. The rule is for the program, so it holds for any port chosen in Conexão.
!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Gutenberg"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Gutenberg" dir=in action=allow program="$INSTDIR\Gutenberg.exe" enable=yes profile=private,domain'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Gutenberg"'
!macroend
