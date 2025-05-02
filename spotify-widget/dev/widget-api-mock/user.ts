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

import {
  SBUserProfile,
  UserListRequestQuery,
  UserListResponse,
} from "@staffbase/widget-sdk";

const user: SBUserProfile = {
  id: "5c35e4feea2d15e6ffa8251d",
  externalID: "abc123",
  primaryEmail: "lucy.liu@company.com",
  primaryUsername: "lucy.liu",
  firstName: "Lucy",
  lastName: "Liu",
  phoneNumber: "09124456",
  publicEmailAddress: "lucy.liu@company.com",
  location: "New York",
  position: "Sales Representative",
  department: "Sales",
};

export const getUserInformation = async (
  _userId?: string
): Promise<SBUserProfile> => user;

export const getUserInformationByExternalId = async (
  _externalId: string
): Promise<SBUserProfile> => user;

export const getUserList = async (
  _query: UserListRequestQuery
): Promise<UserListResponse> => ({
  data: [user, {id: "5e43c6feca2d15e6afa8231d", firstName: "Tony", lastName: "Stark"}],
  offset: 0,
  limit: 1,
  total: 1,
});
