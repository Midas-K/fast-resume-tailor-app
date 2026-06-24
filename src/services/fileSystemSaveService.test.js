const {
  getNextFolderSequenceInDateFolder,
} = require("./fileSystemSaveService");

describe("fileSystemSaveService folder sequencing", () => {
  test("returns 1 for an empty date folder", async () => {
    const dateDirectoryHandle = {
      async *entries() {},
    };

    await expect(getNextFolderSequenceInDateFolder(dateDirectoryHandle)).resolves.toBe(
      1
    );
  });

  test("returns next number after existing numbered folders", async () => {
    const dateDirectoryHandle = {
      async *entries() {
        yield ["1. Affirm - Senior Staff Machine Learning Engineer", { kind: "directory" }];
        yield ["1. Attentive - Staff Software Engineer", { kind: "directory" }];
        yield ["notes.txt", { kind: "file" }];
      },
    };

    await expect(getNextFolderSequenceInDateFolder(dateDirectoryHandle)).resolves.toBe(
      2
    );
  });

  test("uses highest existing sequence even if lower numbers are missing", async () => {
    const dateDirectoryHandle = {
      async *entries() {
        yield ["1. Affirm - Senior Staff Machine Learning Engineer", { kind: "directory" }];
        yield ["3. BetterHelp - Machine Learning Engineer", { kind: "directory" }];
      },
    };

    await expect(getNextFolderSequenceInDateFolder(dateDirectoryHandle)).resolves.toBe(
      4
    );
  });
});
