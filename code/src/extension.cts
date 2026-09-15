import type { ExtensionContext } from "vscode";

let implementation: typeof import("./extension-main.js") | undefined;

/** VS Code의 CommonJS 진입점에서 ESM으로 작성된 확장 구현을 불러와 활성화한다. */
export async function activate(context: ExtensionContext): Promise<unknown> {
  implementation = await import("./extension-main.js");
  return implementation.activate(context);
}

/** 구현이 로드된 경우에만 종료 처리를 위임하고 자원 정리 완료를 호출자에게 전달한다. */
export function deactivate(): Promise<void> | undefined {
  return implementation?.deactivate();
}
