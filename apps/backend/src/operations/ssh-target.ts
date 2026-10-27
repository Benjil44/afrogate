/**
 * SSH destination check for protocol server-apply. The address is passed to
 * `ssh` as a positional argv entry, so besides shell metacharacters it must
 * never start with `-`: `-oProxyCommand=...` would be parsed as an option and
 * run a local command as the backend user.
 */
export function isSafeSshHost(value: string): boolean {
  return value.length > 0 && value.length <= 253 && !value.startsWith('-') && !/[\s"'`;$\\]/.test(value);
}
