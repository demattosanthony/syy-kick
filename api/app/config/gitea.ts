import { giteaApi } from "gitea-js";
import { fetch } from "bun";

const gitea = giteaApi(process.env.GITEA_API_URL!, {
  token: process.env.GITEA_API_KEY, // generate one at https://gitea.example.com/user/settings/applications
  customFetch: fetch,
});

export default gitea;
