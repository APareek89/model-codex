const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  [/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  [/hf_[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  [/AIza[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  [/((?:api[-_ ]?key|access[-_ ]?token|client[-_ ]?secret|authorization)\s*[:=]\s*(?:bearer\s+)?)[^\s"']{8,}/gi, "$1[redacted]"],
];

export function redactSecrets(value: string) {
  return SECRET_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export function containsSecret(value: string) {
  return redactSecrets(value) !== value;
}

export function redactSecretsDeep<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactSecretsDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSecretsDeep(item)])) as T;
  }
  return value;
}
