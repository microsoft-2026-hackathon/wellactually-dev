/** 외부 입력이 null이나 배열이 아닌 객체인지 확인해 속성 검사에 사용할 수 있도록 좁힌다. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 객체 입력을 검증해 반환하고, 형식이 다르면 호출자가 지정한 오류 코드로 거절한다. */
export function record(value: unknown, code = "INVALID_OBJECT"): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(code);
  return value;
}

/** 공백뿐인 값과 UTF-8 바이트 제한을 넘는 입력을 거절하되, 유효한 문자열 원문은 유지한다. */
export function text(value: unknown, maxBytes: number, code: string): string {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new Error(code);
  }
  return value;
}
