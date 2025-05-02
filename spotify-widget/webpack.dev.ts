/*!
 * Copyright 2023, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as path from "path";
import * as webpack from "webpack";
import common from "./webpack.common";
import { merge } from "webpack-merge";
import "webpack-dev-server";

const config: webpack.Configuration = merge(common, {
  entry: {
    "staffbase.spotify-widget": "./src/dev.ts",
    config: "./dev/config.tsx",
    bootstrap: "./dev/bootstrap.ts",
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "resources"),
    },
    compress: true,
    port: 9000,
  },
  mode: "development",
  devtool: "inline-source-map",
});

export default config;
