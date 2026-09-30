import { render } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { HighlightedCode } from "./HighlightedCode";

describe("HighlightedCode", () => {
  test("colors a line with the tokens that spell it out", () => {
    const { container } = render(
      <pre>
        <HighlightedCode
          content="const a"
          tokens={[
            { color: "#cf222e", content: "const" },
            { content: " " },
            { color: "#0550ae", content: "a", fontStyle: 1 },
          ]}
        />
      </pre>,
    );
    const spans = container.querySelectorAll("span");

    expect(container.textContent).toBe("const a");
    expect(spans[0]?.style.color).toBe("rgb(207, 34, 46)");
    expect(spans[2]?.style.fontStyle).toBe("italic");
  });

  test("stays plain when the tokens belong to another version of the line", () => {
    const { container } = render(
      <pre>
        <HighlightedCode content="const b" tokens={[{ color: "#cf222e", content: "const a" }]} />
      </pre>,
    );

    expect(container.textContent).toBe("const b");
    expect(container.querySelector("span")).toBeNull();
  });

  test("accepts tokens of a Windows line, and keeps empty lines one space high", () => {
    const { container } = render(
      <>
        <pre>
          <HighlightedCode content={"a\r"} tokens={[{ color: "#cf222e", content: "a" }]} />
        </pre>
        <pre>
          <HighlightedCode content="" tokens={[]} />
        </pre>
      </>,
    );
    const [windowsLine, emptyLine] = container.querySelectorAll("pre");

    expect(windowsLine?.querySelector("span")?.style.color).toBe("rgb(207, 34, 46)");
    expect(emptyLine?.textContent).toBe(" ");
  });
});
