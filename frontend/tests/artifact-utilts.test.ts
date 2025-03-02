import { expect, test, describe } from "bun:test";
import { Message } from "ai/react";
import { Artifact } from "@/types/chat";
import {
  extractSpecialContent,
  getArtifactVersionInfo,
} from "@/lib/artifact-utils";

describe("extractSpecialContent", () => {
  test("extracts thinking content", () => {
    const content =
      "Hello <antThinking>I am thinking about this</antThinking> World";
    const result = extractSpecialContent(content);

    expect(result.thinking).toBe("I am thinking about this");
    expect(result.artifact).toBeNull();
    expect(result.cleanContent).toBe("Hello  World");
  });

  test("extracts artifact content", () => {
    const content =
      'Check this <antArtifact identifier="123" type="code" title="Example Code">console.log("hello");</antArtifact> out';
    const result = extractSpecialContent(content);

    expect(result.thinking).toBeNull();
    expect(result.artifact).toEqual({
      identifier: "123",
      type: "code",
      title: "Example Code",
      content: 'console.log("hello");',
      isComplete: true,
      rawContent: 'console.log("hello");',
    });
    expect(result.cleanContent).toBe("Check this  out");
  });

  test("handles incomplete artifact tag", () => {
    const content =
      'Check this <antArtifact identifier="123" type="code" title="Example Code">console.log("hello");';
    const result = extractSpecialContent(content);

    expect(result.artifact?.isComplete).toBe(false);
    expect(result.artifact?.content).toBe('console.log("hello");');
  });

  test("handles both thinking and artifact", () => {
    const content =
      'Hello <antThinking>Thinking process</antThinking> <antArtifact identifier="123" type="code" title="Example">code</antArtifact>';
    const result = extractSpecialContent(content);

    expect(result.thinking).toBe("Thinking process");
    expect(result.artifact).not.toBeNull();
    expect(result.cleanContent).toBe("Hello");
  });
  test("handles content with no special tags", () => {
    const content = "Just a regular message";
    const result = extractSpecialContent(content);

    expect(result.thinking).toBeNull();
    expect(result.artifact).toBeNull();
    expect(result.cleanContent).toBe("Just a regular message");
  });
});

describe("getArtifactVersionInfo", () => {
  test("finds current version of an artifact", () => {
    const artifact: Artifact = {
      identifier: "abc123",
      type: "code",
      title: "Test Code",
      content: "function test() {}",
      isComplete: true,
    };

    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Test Code">function init() {}</antArtifact>',
      },
      {
        id: "2",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Test Code">function test() {}</antArtifact>',
      },
    ];

    const result = getArtifactVersionInfo(artifact, messages);

    expect(result.version).toBe(2);
    expect(result.content).toBe("function test() {}");
    expect(result.title).toBe("Test Code");
  });

  test("handles artifact not found in messages", () => {
    const artifact: Artifact = {
      identifier: "xyz789",
      type: "code",
      title: "New Code",
      content: 'console.log("new");',
      isComplete: true,
    };

    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Test Code">function test() {}</antArtifact>',
      },
    ];

    const result = getArtifactVersionInfo(artifact, messages);

    expect(result.version).toBe(1);
    expect(result.content).toBe('console.log("new");');
    expect(result.title).toBe("New Code");
  });

  test("handles multiple versions of the same artifact", () => {
    const artifact: Artifact = {
      identifier: "abc123",
      type: "code",
      title: "Evolving Code",
      content: "function v3() {}",
      isComplete: true,
    };

    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Evolving Code">function v1() {}</antArtifact>',
      },
      {
        id: "2",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Evolving Code">function v2() {}</antArtifact>',
      },
      {
        id: "3",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Evolving Code">function v3() {}</antArtifact>',
      },
    ];

    const result = getArtifactVersionInfo(artifact, messages);

    expect(result.version).toBe(3);
    expect(result.content).toBe("function v3() {}");
  });

  test("handles non-string message content", () => {
    const artifact: Artifact = {
      identifier: "abc123",
      type: "code",
      title: "Test",
      content: "test",
      isComplete: true,
    };

    const messages: Message[] = [
      { id: "1", role: "assistant", content: null as any },
      {
        id: "2",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Test">test</antArtifact>',
      },
    ];

    const result = getArtifactVersionInfo(artifact, messages);

    expect(result.version).toBe(1);
    expect(result.content).toBe("test");
  });

  test("returns latest version when exact match not found", () => {
    const artifact: Artifact = {
      identifier: "abc123",
      type: "code",
      title: "Modified Code",
      content: "modified content",
      isComplete: true,
    };

    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Modified Code">version 1</antArtifact>',
      },
      {
        id: "2",
        role: "assistant",
        content:
          '<antArtifact identifier="abc123" type="code" title="Modified Code">version 2</antArtifact>',
      },
    ];

    const result = getArtifactVersionInfo(artifact, messages);

    expect(result.version).toBe(2);
    expect(result.content).toBe("version 2");
  });
});
