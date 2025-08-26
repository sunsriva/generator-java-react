import Generator from "yeoman-generator";
import { execSync } from "child_process";
import fs from "fs";

export default class extends Generator {
  async prompting() {
    this.log("Fetching Spring Boot metadata...");
    const res = await fetch("https://start.spring.io/metadata/client");
    const metadata = await res.json();

    const normalizeVersion = (id) =>
      id.replace(".RELEASE", "")
        .replace(".BUILD-SNAPSHOT", "")
        .replace(".SNAPSHOT", "");

    const bootVersions = metadata.bootVersion.values
      .map((v) => ({
        raw: v.id,
        normalized: normalizeVersion(v.id),
        name: v.name,
      }))
      .filter((v) => !v.raw.includes("SNAPSHOT"))
      .map((v) => ({ name: v.name, value: v.normalized }));

    const defaultBoot = normalizeVersion(metadata.bootVersion.default);

    this.answers = await this.prompt([
      { type: "input", name: "groupId", message: "Java Group ID", default: "com.example" },
      { type: "input", name: "artifactId", message: "Base Artifact ID (project name)", default: "demo" },
      { type: "list", name: "bootVersion", message: "Spring Boot version", choices: bootVersions, default: defaultBoot },
      { type: "list", name: "javaVersion", message: "Java version", choices: ["17", "20"], default: "17" },
      { type: "list", name: "packaging", message: "Packaging type", choices: ["jar", "war"], default: "jar" },
    ]);

    // Folders
    this.baseName = this.answers.artifactId;
    this.rootFolder = this.baseName;
    this.backendFolder = `${this.baseName}-backend`;
    this.frontendFolder = `${this.baseName}-frontend`;
    this.parentArtifactId = `${this.baseName}-parent`;
  }

  async writing() {
    const { groupId, bootVersion, javaVersion, packaging } = this.answers;
    const { backendFolder, frontendFolder, baseName, parentArtifactId, rootFolder } = this;

    if (!fs.existsSync(rootFolder)) fs.mkdirSync(rootFolder);

    // 1️⃣ Generate backend from Spring Initializr
    this.log(`Generating backend (${backendFolder}) with Spring Boot ${bootVersion}...`);
    execSync(
      `curl -L -o backend.zip "https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion=${bootVersion}&groupId=${groupId}&artifactId=${baseName}&javaVersion=${javaVersion}&packaging=${packaging}&dependencies=web"`,
      { stdio: "inherit" }
    );
    execSync(`unzip backend.zip -d ${rootFolder}/${backendFolder}`, { stdio: "inherit" });
    execSync("rm backend.zip");

    // 2️⃣ Generate frontend (Vite + React TS)
    this.log(`Generating frontend (${frontendFolder})...`);
    await this.spawnCommand("npm", [
      "create",
      "vite@latest",
      `${rootFolder}/${frontendFolder}`,
      "--",
      "--template",
      "react-ts"
    ]);

    await this.spawnCommand("npm", ["install"], { cwd: `${rootFolder}/${frontendFolder}` });
    await this.spawnCommand("npm", ["run", "build"], { cwd: `${rootFolder}/${frontendFolder}` });

    // 3️⃣ Write parent POM (root)
    this.log("Writing parent pom.xml...");
    this.fs.copyTpl(
      this.templatePath("pom.xml"), // template file
      this.destinationPath(`${rootFolder}/pom.xml`), // parent POM
      {
        groupId,
        artifactId: parentArtifactId,
        backendFolder
      }
    );

    // 4️⃣ Update backend POM safely
    const backendPomPath = `${rootFolder}/${backendFolder}/pom.xml`;
    let backendPom = fs.readFileSync(backendPomPath, "utf8");

    // Update artifactId ONLY if not the Spring Boot parent
    backendPom = backendPom.replace(
      /<artifactId>(?!spring-boot-starter-parent).*<\/artifactId>/,
      `<artifactId>${baseName}-backend</artifactId>`
    );

    // Update packaging
    if (backendPom.includes("<packaging>")) {
      backendPom = backendPom.replace(/<packaging>.*<\/packaging>/, `<packaging>${packaging}</packaging>`);
    } else {
      backendPom = backendPom.replace(
        /(<modelVersion>.*<\/modelVersion>)/,
        `$1\n  <packaging>${packaging}</packaging>`
      );
    }

    // Update java.version safely
    if (backendPom.includes("<java.version>")) {
      backendPom = backendPom.replace(/<java.version>.*<\/java.version>/, `<java.version>${javaVersion}</java.version>`);
    } else {
      backendPom = backendPom.replace(
        /(<parent>)/,
        `  <properties>\n    <java.version>${javaVersion}</java.version>\n  </properties>\n$1`
      );
    }

    // Inject maven-resources-plugin to copy frontend build
    const pluginSnippet = `
      <plugin>
        <artifactId>maven-resources-plugin</artifactId>
        <executions>
          <execution>
            <id>copy-frontend</id>
            <phase>process-resources</phase>
            <goals>
              <goal>copy-resources</goal>
            </goals>
            <configuration>
              <outputDirectory>\${project.build.directory}/classes/static</outputDirectory>
              <resources>
                <resource>
                  <directory>\${project.parent.basedir}/${frontendFolder}/dist</directory>
                  <includes>
                    <include>**/*</include>
                  </includes>
                </resource>
              </resources>
            </configuration>
          </execution>
        </executions>
      </plugin>
    `;

    if (backendPom.includes("<plugins>")) {
      backendPom = backendPom.replace(/<plugins>/, `<plugins>${pluginSnippet}`);
    } else {
      backendPom = backendPom.replace(/<build>/, `<build>\n<plugins>${pluginSnippet}</plugins>`);
    }

    fs.writeFileSync(backendPomPath, backendPom);
  }

  async install() {
    const { rootFolder, backendFolder } = this;
    this.log("Running Maven build for backend module...");
    execSync("mvn clean install", { cwd: `${rootFolder}/${backendFolder}`, stdio: "inherit" });
    this.log(`Project generation complete! Run: java -jar ${backendFolder}/target/*.jar`);
  }
}
