/*!
 * Copyright 2024, Staffbase GmbH and contributors.
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

import { ColorTheme, SBColors, SBFileType } from "@staffbase/widget-sdk";

const fileType: SBFileType = {
  default: "#808080",
  ppt: "#BC361A",
  xls: "#127139",
  doc: "#1650B5",
  pdf: "#FF1D16",
  img: "#333333",
};

const colors: SBColors = {
  fileType,
  backdrop: "rgba(0,0,0,0.6)",
  backgroundField: "#FAFAFA",
  backgroundFieldLight: "#FFFFFF",
  backgroundPrimary: "#FFFFFF",
  backgroundSecondary: "#F5F5F5",
  backgroundTertiary: "#E5E5E5",
  black: "#000000",
  borderSolid: "#E5E5E5",
  borderTranslucent: "rgba(0,0,0,0.1)",
  clientForeground: "#FFFFFF",
  clientPrimary: "#00A4FD",
  clientPrimaryA11y: "#00A4FD",
  clientSecondary: "#FFFFFF",
  clientSecondaryA11y: "#FFFFFF",
  textPlaceholder: "#949494",
  textPrimary: "#333333",
  textSecondary: "#545454",
  textTertiary: "#757575",
  pressedState: "#D9D9D9",
  hoverState: "#E5E5E5",
  backgroundBase: "#ffffff",
  backgroundLevel1: "#fafafa",
  backgroundLevel2: "#f6f6f6",
  backgroundLevel3: "#d9d9d9",
  backgroundLevel4: "#afafaf",
  blue: "#00a4fd",
  blueDark: "#0094e4",
  blueLight: "#40b6fe",
  green: "#52b056",
  greenDark: "#499f4c",
  greenLight: "#74c078",
  grey: "#767676",
  greyDark: "#6a6a6a",
  greyLight: "#919191",
  hairline: "#ececec",
  hairlineDark: "#dddddd",
  neutral: "#555555",
  neutralDark: "#4d4d4d",
  neutralLight: "#767676",
  orange: "#f5bd66",
  orangeDark: "#f3af45",
  orangeLight: "#f7ca85",
  overlay: "#333333",
  overlayDark: "rgba(42, 42, 42, 0.6)",
  red: "#f1493d",
  redDark: "#ef2f21",
  redLight: "#f46e65",
  text: "#333333",
  textGreyBase: "#767676",
  textGreyLevel1: "#737373",
  textGreyLevel2: "#717171",
  textGreyLevel3: "#5f5f5f",
  textGreyLevel4: "#434343",
  textLight: "#ffffff",
  warningYellow: "#F4DF79",
};

export default (): ColorTheme => ({
  bgColor: "#00A4FD",
  textColor: "#FFFFFF",
  colors,
});
