import { expect, test } from "vitest";

function sum(a: number, b: number): number {
	return a + b;
}

test("adds 1 + 2 to equal 3", () => {
	expect(sum(1, 2)).toBe(3);
});

test("handles negative numbers", () => {
	expect(sum(-1, 1)).toBe(0);
});

test("handles zero", () => {
	expect(sum(0, 0)).toBe(0);
});
