/**
 * Whether a YAML/parent echo should replace the text currently shown in a field.
 * Same text is left alone so the caret stays where the user is typing.
 * A focused field also keeps its draft until blur, even when the echo differs
 * (quotes, stale resolve, keystroke round-trip).
 */
export function shouldAdoptFieldValue(
  current: string,
  incoming: string,
  focused: boolean,
): boolean {
  if (current === incoming) {
    return false;
  }
  if (focused) {
    return false;
  }
  return true;
}
