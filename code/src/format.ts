export type MessageValues = Readonly<Record<string, string | number>>;

/** 문구의 {name} 자리표시자를 치환하며, 필요한 값이 빠졌으면 불완전한 문구 대신 오류를 낸다. */
export function formatMessage(template: string, values: MessageValues = {}): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match: string, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error("MISSING_TRANSLATION_ARGUMENT");
    return String(values[name]);
  });
}
