import path from "node:path";
import shell from "shelljs";

test("Tailwind works on the Next App's build process", () => {
  // Just a function that runs `shell.exec` and expects it returns code 0, i.e. expects command not to fail
  //
  // Defaults the CWD to the @react-email/tailwind project's directory
  const $ = (command: string, cwd: string = path.resolve(__dirname, "..")) => {
    expect(
      shell.exec(command, { cwd, fatal: true }).code,
      `Expected command "${command}" to work properly but it returned a non-zero exit code`,
    ).toBe(0);
  };

  $("pnpm build");
  $("npx yalc installations clean @react-email/tailwind");
  $("npx yalc publish");

  const nextAppLocation = path.resolve(__dirname, "../automated-test-next-app");
  $("npm install", nextAppLocation);
  $("npx yalc remove @react-email/tailwind", nextAppLocation);
  $("npx yalc add @react-email/tailwind", nextAppLocation);
  $("npm run build", nextAppLocation);
});