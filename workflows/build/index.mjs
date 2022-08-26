// Build todoapp, the hard way
import { gql, Engine } from "@dagger.io/dagger";

new Engine({
  ConfigPath: process.env.CLOAK_CONFIG,
}).run(async (client) => {
  // 1. Load app source code from working directory

  try {
    const sourceCode = await client.request(gql`
      {
        host {
          workdir {
            read {
              id
            }
          }
        }
      }
    `);

    const image = await client.request(gql`
      {
        core {
          image(ref: "index.docker.io/alpine") {
            exec(
              input: { args: ["apk", "add", "npm", "git", "openssh-client"] }
            ) {
              stdout
              fs {
                id
              }
            }
          }
        }
      }
    `);

    const installDeps = await client.request(gql`
    	{
    		core {
    			filesystem(id: "${image.core.image.exec.fs.id}") {
    				exec(input: {
							args: ["npm", "install"],			
							mounts: [{path: "/src", fs: "${sourceCode.host.workdir.read.id}"}],
							workdir: "/src"
						 }) {
							mount(path: "/src") {
								id
							}
						}
    			}
    		}
    	}
    `);

    const buildApp = await client.request(gql`
			{
				core {
					filesystem(id: "${image.core.image.exec.fs.id}") {
						exec(input: {
							args: ["./node_modules/.bin/react-scripts", "build"],
							mounts: [{path: "/src", fs: "${installDeps.core.filesystem.exec.mount.id}"}],
							workdir: "/src"
						}) {
							stdout
							mount(path: "/src") {
								id
							}
						}
					}
				}
			}
		`);

    await client.request(gql`
      {
        host {
          workdir {
            write(contents: "${buildApp.core.filesystem.exec.mount.id}")
          }
        }
      }
    `);

  } catch (err) {
    console.log(`error: ${err}`);
  }
});
