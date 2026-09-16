export interface InlineText { kind: "text" | "strong" | "code"; text: string }
export type MessageBlock =
  | { kind: "paragraph" | "heading"; content: readonly InlineText[] }
  | { kind: "list"; ordered: boolean; start?: number; items: readonly (readonly InlineText[])[] }
  | { kind: "code"; language: string; text: string };

/** 인라인 코드와 굵은 글씨만 구분하고, 나머지는 실행되지 않는 일반 텍스트로 남긴다. */
function inline(value: string): InlineText[] {
  const parts: InlineText[] = [];
  let offset = 0;
  for (const match of value.matchAll(/`([^`\n]+)`|\*\*([^*\n]+)\*\*/g)) {
    const index = match.index;
    if (index > offset) parts.push({ kind: "text", text: value.slice(offset, index) });
    parts.push(match[1] !== undefined ? { kind: "code", text: match[1] } : { kind: "strong", text: match[2]! });
    offset = index + match[0].length;
  }
  if (offset < value.length) parts.push({ kind: "text", text: value.slice(offset) });
  return parts;
}

/** 응답을 문단·제목·목록·코드 블록으로 나누며, HTML이나 링크 문법은 해석하지 않는다. */
export function parseChatMessage(value: string): MessageBlock[] {
  const lines = value.replaceAll("\r\n", "\n").split("\n");
  const blocks: MessageBlock[] = [];
  let paragraph: string[] = [];
  /** 모아 둔 줄을 하나의 문단으로 확정하고 다음 블록을 받을 버퍼를 비운다. */
  const flush = (): void => {
    if (paragraph.length) blocks.push({ kind: "paragraph", content: inline(paragraph.join("\n")) });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const fence = line.match(/^\s*```([A-Za-z0-9_+#.-]*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      for (index++; index < lines.length && !/^\s*```\s*$/.test(lines[index]!); index++) code.push(lines[index]!);
      blocks.push({ kind: "code", language: fence[1] ?? "", text: code.join("\n") });
    } else if (!line.trim()) {
      flush();
    } else {
      const list = line.match(/^\s*(?:([-*])|(\d{1,9})[.)])\s+(.+)$/);
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (list) {
        flush();
        const ordered = list[2] !== undefined;
        const items: InlineText[][] = [inline(list[3]!)];
        while (index + 1 < lines.length) {
          const next = lines[index + 1]!.match(/^\s*(?:([-*])|(\d{1,9})[.)])\s+(.+)$/);
          if (!next || (next[2] !== undefined) !== ordered) break;
          items.push(inline(next[3]!)); index++;
        }
        blocks.push({ kind: "list", ordered, ...(ordered ? { start: Number(list[2]) } : {}), items });
      } else if (heading) {
        flush();
        blocks.push({ kind: "heading", content: inline(heading[1]!) });
      } else paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** 모델이 만든 HTML을 삽입하지 않고, 허용된 서식과 텍스트 노드로 메시지 DOM을 구성한다. */
export function renderChatMessage(doc: Document, target: HTMLElement, value: string): void {
  const fragment = doc.createDocumentFragment();
  /** 인라인 서식을 DOM 요소로 바꾸되 실제 내용은 항상 텍스트로 삽입한다. */
  const appendInline = (parent: HTMLElement, parts: readonly InlineText[]): void => {
    for (const part of parts) {
      if (part.kind === "text") parent.append(doc.createTextNode(part.text));
      else {
        const element = doc.createElement(part.kind === "code" ? "code" : "strong");
        element.textContent = part.text;
        parent.append(element);
      }
    }
  };
  for (const block of parseChatMessage(value)) {
    if (block.kind === "code") {
      const pre = doc.createElement("pre");
      const code = doc.createElement("code");
      code.textContent = block.text;
      pre.append(code);
      fragment.append(pre);
    } else if (block.kind === "list") {
      const list = doc.createElement(block.ordered ? "ol" : "ul");
      if (block.ordered && block.start !== undefined) list.setAttribute("start", String(block.start));
      for (const item of block.items) {
        const li = doc.createElement("li");
        appendInline(li, item);
        list.append(li);
      }
      fragment.append(list);
    } else {
      const paragraph = doc.createElement("p");
      if (block.kind === "heading") paragraph.className = "message-heading";
      appendInline(paragraph, block.content);
      fragment.append(paragraph);
    }
  }
  target.replaceChildren(fragment);
}

/** 한글 입력 조합·키 반복·Shift 줄바꿈을 제외한 Enter 입력만 질문 전송으로 판단한다. */
export function shouldSendKey(event: Pick<KeyboardEvent, "key" | "shiftKey" | "isComposing" | "keyCode" | "repeat">): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229 && !event.repeat;
}
