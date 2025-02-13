import glob from "glob";
import { basename } from "path";
import { readFile } from "fs";
import { promisify } from "util";
import { XMLParser } from "fast-xml-parser";
import { exec, spawn } from "child_process";
import { getPiralVersion } from "./piral";
import { action, analyzer, configuration, targetFramework } from "./constants";

const execAsync = promisify(exec);

const matchVersion = /\d+\.\d+\.\d+/;

/** Extracts the project name from a blazor project folder */
export function getProjectName(projectFolder: string) {
  return new Promise((resolve, reject) => {
    glob(`${projectFolder}/*.csproj`, (err, matches) => {
      if (!!err || !matches || matches.length == 0)
        return reject(new Error(`Project file not found. Details: ${err}`));
      if (matches.length > 1)
        return reject(
          new Error(
            `Only one project file is allowed. You have: ${JSON.stringify(
              matches,
              null,
              2
            )}`
          )
        );
      const path = matches[0];
      const defaultAssetName = basename(matches[0]).replace(".csproj", "");

      readFile(path, "utf8", (err, xmlData) => {
        if (err) {
          reject(err);
        } else {
          const xmlParser = new XMLParser();
          const { Project } = xmlParser.parse(xmlData);

          if (
            typeof Project.PropertyGroup === "object" &&
            Project.PropertyGroup
          ) {
            const propertyGroups = Array.isArray(Project.PropertyGroup)
              ? Project.PropertyGroup
              : [Project.PropertyGroup];
            const propertyGroup = propertyGroups.find((p) => p.AssemblyName);

            if (propertyGroup) {
              return resolve(propertyGroup.AssemblyName);
            }
          }

          resolve(defaultAssetName);
        }
      });
    });
  });
}

export async function buildSolution(cwd: string) {
  console.log(`Running "${action}" on solution in ${configuration} mode...`);

  process.env.PIRAL_BLAZOR_RUNNING = "yes";

  return new Promise<void>((resolve, reject) => {
    const ps = spawn(`dotnet`, [action, "--configuration", configuration], {
      cwd,
      env: process.env,
      detached: false,
      stdio: "inherit",
    });

    ps.on("error", reject);
    ps.on("exit", resolve);
  });
}

export async function checkInstallation(
  piletBlazorVersion: string,
  shellPackagePath: string
) {
  try {
    require.resolve("piral-blazor/package.json");
    require.resolve("blazor/package.json");
  } catch {
    console.warn(
      "The npm packages `blazor` and `piral-blazor` have not been not found. Installing them now..."
    );
    const piralVersion = getPiralVersion(shellPackagePath);
    const result = matchVersion.exec(piletBlazorVersion);

    if (!result) {
      throw new Error(
        "Could not detect version of Blazor. Something does not seem right."
      );
    }

    const [npmBlazorVersion] = result;
    const [blazorRelease] = npmBlazorVersion.split(".");
    const installCmd = `npm i blazor@^${blazorRelease} piral-blazor@${piralVersion} --no-save --legacy-peer-deps`;
    await execAsync(installCmd);
  }
}

export async function analyzeProject(blazorprojectfolder: string) {
  const projectName = await getProjectName(blazorprojectfolder);
  const command = `dotnet ${analyzer} --base-dir "${blazorprojectfolder}" --dll-name "${projectName}.dll" --target-framework "${targetFramework}" --configuration "${configuration}"`;
  const { stdout, stderr } = await execAsync(command);

  if (stderr) {
    throw new Error(stderr);
  }

  const { routes, extensions } = JSON.parse(stdout.trim()) as {
    routes: Array<string>;
    extensions: Record<string, Array<string>>;
  };
  return { routes, extensions };
}
