# Building a Fullstack Project Generator with Yeoman


## Lesson 1: What is Yeoman and Why Use It?

### Concepts

* **Scaffolding**: automating repetitive project setup (instead of copy-paste).
* **Yeoman**: a Node.js-based generator framework that lets you define project templates.

### Why Yeoman for our case?

* We often need **Java (Spring Boot) + React** apps.
* Setting up both projects manually takes time.
* Yeoman helps us create a **consistent boilerplate** in seconds.

**Outcome**: You’ll understand why we use Yeoman to generate fullstack projects.

---

## Lesson 2: Setting Up the Generator

### Install prerequisites

```bash
npm install -g yo
mkdir generator-java-react && cd generator-java-react
npm init -y
npm install yeoman-generator
```

### Add entrypoint `index.js`

```js
import Generator from "yeoman-generator";

export default class extends Generator {
  async prompting() {
    this.answers = await this.prompt([
      { type: "input", name: "groupId", message: "Java Group ID", default: "com.example" },
      { type: "input", name: "artifactId", message: "Artifact ID (base name)", default: "demo" }
    ]);
  }

  async writing() {
    this.log("Scaffolding will go here...");
  }
}
```

**Outcome**: Running `yo java-react` prompts the user.

---

##  Lesson 3: Generating the Backend (Spring Boot)

### Use Spring Initializr API

```js
import { execSync } from "child_process";

const { groupId, artifactId } = this.answers;
execSync(
  `curl -L -o backend.zip "https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion=3.5.5&groupId=${groupId}&artifactId=${artifactId}&dependencies=web"`,
  { stdio: "inherit" }
);
execSync(`unzip backend.zip -d ${artifactId}-backend`, { stdio: "inherit" });
execSync("rm backend.zip");
```

**Outcome**: We now generate a Spring Boot project (`artifactId-backend`).

---

## Lesson 4: Adding the Frontend (React + Vite)

### Scaffold React app

```js
await this.spawnCommand("npm", [
  "create",
  "vite@latest",
  `${artifactId}-frontend`,
  "--",
  "--template",
  "react-ts",
]);
```

**Outcome**: A frontend React app (`artifactId-frontend`) is generated alongside the backend.

---

## Lesson 5: Parent POM and Multi-Module Setup

We want a structure like this:

```
my-app/
├── pom.xml  (parent)
├── my-app-backend/
└── my-app-frontend/
```

### Parent POM template

```xml
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId><%= groupId %></groupId>
  <artifactId><%= artifactId %>-parent</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <packaging>pom</packaging>

  <modules>
    <module><%= artifactId %>-backend</module>
  </modules>
</project>
```

**Outcome**: We have a **multi-module project**, where only the backend is Maven-managed.

---

## Lesson 6: Wiring Frontend into Backend Build

We want the backend JAR to serve React automatically.

### Add `maven-resources-plugin` to backend POM

```xml
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
        <outputDirectory>${project.build.directory}/classes/static</outputDirectory>
        <resources>
          <resource>
            <directory>${project.parent.basedir}/<%= artifactId %>-frontend/dist</directory>
            <includes>
              <include>**/*</include>
            </includes>
          </resource>
        </resources>
      </configuration>
    </execution>
  </executions>
</plugin>
```

**Outcome**:

1. Run `npm run build` in frontend.
2. Run `mvn clean package` in parent project.
3. Final JAR serves React files.

---

## Lesson 7: Adding Extra Features

* Prompt for **Java version** (`11`, `17`, `21`)
* Prompt for **packaging** (`jar` or `war`)
* Keep `spring-boot-starter-parent` intact in backend pom
* Add other dependencies (`jpa`, `security`, etc.) in the future

**Outcome**: The generator becomes customizable and production-ready.

---

## Final Project

Run:

```bash
yo java-react
```

You get:

```
my-app/
├── pom.xml
├── my-app-backend/
│   └── pom.xml
└── my-app-frontend/
```

* ✅ Spring Boot backend
* ✅ React frontend
* ✅ Single deployable JAR with frontend included
* ✅ Configurable via prompts

---


## Why `yo java-react`?

When you run:

```bash
yo <name>
```

Yeoman looks for a **generator package named `generator-<name>`**.

So:

* `yo java-react` → Yeoman searches for `generator-java-react`.
* `yo angular` → Yeoman searches for `generator-angular`.
* `yo mycompany` → Yeoman searches for `generator-mycompany`.

That’s why your project folder is called `generator-java-react` — Yeoman automatically strips the `generator-` prefix when you invoke it.

---

### How it works internally

1. **NPM package name** must follow convention:

   ```
   generator-<something>
   ```

   e.g. `generator-java-react`

2. When installed globally (`npm link` or `npm install -g`), Yeoman exposes it under the short name:

   ```
   yo <something>
   ```

   → Yeoman automatically drops `generator-`

So:

* Project: `generator-java-react`
* Command: `yo java-react`

---

### Why not `yo anything-else`?

You absolutely could! The command depends only on your generator’s name:

* If you name your package `generator-fullstack`, you’d run `yo fullstack`.
* If you call it `generator-spring-react`, you’d run `yo spring-react`.

It’s just convention. In your case, we named the package `generator-java-react`, so the corresponding command is `yo java-react`.

---

**In short**:
You run `yo java-react` because your package is `generator-java-react`. Yeoman strips the `generator-` prefix automatically.


