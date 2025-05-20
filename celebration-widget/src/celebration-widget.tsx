/*!
 * Copyright 2020, Staffbase GmbH and contributors.
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

import React, { ReactElement } from "react";
import { BlockAttributes } from "widget-sdk";

/**
 * React Component
 */
export interface CelebrationWidgetProps extends BlockAttributes {
  anniversaryprofilefieldid: string;
  dateformat: string;
  includepending: boolean;
  loadingmessage: string;
  noinstancesmessage: string;
  title: string;
  todaytitle: string;
  yearword: string;
  yearwordplural: string;
  showdate: boolean;
  hideemptywidget: boolean;
  showwholemonth: boolean;
  showwholemonthforxdays: number;
  showdaysbefore: number;
  showdaysafter: number;
  specialyears: string;
  hideyearheader: boolean;
  linktochat: boolean;
  limit: number;
  imageurl: string;
  headercolor: string;
  additionalfieldsdisplayed: string;
  optoutgroupid: string;
  includeyear: boolean;
  daysbeforetitle: string;
  daysaftertitle: string;
  groupid: string;
  networkid: string;
  numbertoshow: number;
  fieldfilter: string;
  fieldvalue: string;
  optoutfield: string;
  optoutvalue: string;
}

export const CelebrationWidget = ({ dateformat, anniversaryprofilefieldid, includepending, numbertoshow, loadingmessage, noinstancesmessage, title, todaytitle, yearword, yearwordplural, showdate, hideemptywidget, showwholemonth, groupid, showwholemonthforxdays, imageurl, showdaysbefore, showdaysafter, splitbyyear, specialyears, hideyearheader, linktochat, limit, headercolor, additionalfieldsdisplayed, optoutgroupid, includeyear, daysbeforetitle, daysaftertitle, networkid, fieldfilter, fieldvalue, optoutfield, optoutvalue }: CelebrationWidgetProps): ReactElement => {
  const compareDates = (dateOne: string, dateTwo: string, dateformat = 'DD.MM') => {

    //Allow for single digit value & filter for YYYY values by removing array items longer then 2 chars 
    const dateAarray = dateOne.split(/[./-]+/).filter(item => (item.length <= 2));
    const dateBarray = dateTwo.split(/[./-]+/).filter(item => (item.length <= 2));

    // If the widget is in anniversary mode, the year is taken into consideration when comparing, otherwise only the month and date are compared.
    const dateA = new Date (0, parseInt(dateformat === "DD.MM" ? dateAarray[1] : dateAarray[0]) - 1, parseInt(dateformat === "DD.MM" ? dateAarray[0] : dateAarray[1]));
    const dateB = new Date (0, parseInt(dateformat === "DD.MM" ? dateBarray[1] : dateBarray[0]) - 1, parseInt(dateformat === "DD.MM" ? dateBarray[0] : dateBarray[1]));

    return {
      sameDate: dateA.getTime() === dateB.getTime(),
      sameMonth: dateA.getMonth() === dateB.getMonth(),
      daysDiff: Math.ceil((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  const convertDate = (date: string, dateformat = 'DD.MM') => {

    const dateArray = date.split(/[./-]+/).filter(item => (item.length <= 2));

    const dateVal = new Date (0, parseInt(dateformat === "DD.MM" ? dateArray[1] : dateArray[0]) - 1, parseInt(dateformat === "DD.MM" ? dateArray[0] : dateArray[1]));
    return dateVal.toLocaleString((dateformat === "DD.MM" ? 'default' : 'en-US'), { month: 'long', day: 'numeric' });
  }

  let usersByGroupCondition = {},
    anniversariesCount = 0;
  const dateNow = new Date().toLocaleDateString(dateformat == 'DD.MM' ? 'de-DE' : 'en-US', { year:'numeric', month: '2-digit', day: '2-digit' }),
    daysSinceBeginningOfMonth = compareDates(dateNow, dateformat == 'DD.MM' ? '01' + dateNow.substring(2) : dateNow.substring(0,3) + '01' , dateformat).daysDiff;

  const imgstyles: { [key: string]: React.CSSProperties } = {
    container: {
      width: '55px',
      height: '55px',
      verticalAlign: 'top',
      borderRadius: '5px',
      marginInlineEnd: '15px'
    },
  };

  const spanstyles: { [key: string]: React.CSSProperties } = {
    container: {
      width: '55px',
      height: '55px',
      backgroundColor: we.authMgr.getBranch().colors.backgroundColor,
      fontSize: '26px',
      lineHeight: '55px',
      color: we.authMgr.getBranch().colors.textColor,
      textAlign: 'center',
      verticalAlign: 'top',
      borderRadius: '5px',
      marginRight: '15px',
      display: 'inline-block'
    },
  };

  const chatBtnStyles: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    lineHeight: '1',
    border: 'none',
    cursor: 'pointer',
    background: '#007AFF',          // ↳ tweak if your brand colour differs
    color: '#FFFFFF',
  };
  

  const h2styles: { [key: string]: React.CSSProperties } = {
    container: {
      color: '#' + (headercolor ? headercolor : '000000')
    },
  };

  const divstyles: { [key: string]: React.CSSProperties } = {
    container: {
      borderRadius: '10px',
      border: '1px solid #D3D3D3',
      padding: '8px',
      margin: '10px 0px',
      backgroundColor: '#FFFFFF',
    },
  };

  const pstyles: { [key: string]: React.CSSProperties } = {
    container: {
      display: 'inline-block',
      marginTop: '0',
      color: '#000000'
    },
  };

  const hrstyles: { [key: string]: React.CSSProperties } = {
    container: {
      margin: '0'
    },
  };

  const namestyles: { [key: string]: React.CSSProperties } = {
    container: {
      fontSize: '16px'
    },
  };

  const datestyles: { [key: string]: React.CSSProperties } = {
    container: {
      fontSize: '12px'
    },
  };


  const [usersList, setUsers] = React.useState([{}]);
  const [usersAreLoaded, setLoaded] = React.useState(Boolean);
  const [networkID, setNID] = React.useState(String);

  React.useEffect(() => {
    setLoaded(false);

    if(includepending === 'true') {

      const getNetworkUsers = async (limit: number, offset:number, users:Array<Object>) => {
        const loadedUsers  = await we.api.call("installations/" + networkid + "/users", {'limit': limit, 'offset': offset}, {type: 'GET'});
        users = users.concat(loadedUsers.data);
        if(loadedUsers.total < limit + offset){
          setUsers(users);
          setLoaded(true);
        } else {
          await getNetworkUsers(limit, limit+offset, users);
        }
      }
      getNetworkUsers(1000, 0, []).catch(console.error);

    } else {
      const getAllUsers = async (limit: number, offset:number, users:Array<Object>) => {
        const loadedUsers  = await we.api.getUsers({'status': 'activated', 'limit': limit, 'offset': offset});
        users = users.concat(loadedUsers.data);
        if(loadedUsers.total <= limit + offset){
          setUsers(users);
          setLoaded(true);
        } else {
          await getAllUsers(limit, limit+offset, users);
        }
      };
  
      getAllUsers(1000,0,[]).catch(console.error);

    }

  }, [networkID]);


  const filteredUsers = usersList.filter(user => {
    //if (groupid !== undefined && (!user.groupIDs || (user.groupIDs && !user.groupIDs.includes(groupid)))) return false;
    //if (user.groupIDs && (optoutgroupid !== undefined && optoutgroupid !== "") && (user.groupIDs.some(id => optoutgroupid.split(",").includes(id)))) return false;
    if (!user.profile || typeof(user.profile[anniversaryprofilefieldid]) === 'undefined') return false;
    //filter users that should be part of widget
    if (fieldfilter !== "" && fieldfilter !== undefined){
      const fieldvalarr = fieldvalue.split(",").map(val => val.toLowerCase());
      if (user.profile && ((user.profile[fieldfilter] && !fieldvalarr.includes(user.profile[fieldfilter].toLowerCase())) || (typeof(user.profile[fieldfilter]) === 'undefined'))) return false;
    }
    // filter out users that have opted out
    if (optoutfield !== "" && optoutfield !== undefined){
      const optoutValArr = optoutvalue.split(",").map(val => val.toLowerCase());
      if (user.profile && (user.profile[optoutfield] && optoutValArr.includes(user.profile[optoutfield].toLowerCase()))) return false;
    }

    if (user.profile[anniversaryprofilefieldid] == '' || user.profile[anniversaryprofilefieldid] == null) return false;
    const dateComparison = compareDates(user.profile[anniversaryprofilefieldid], dateNow, dateformat);
    if (showwholemonth === 'true') return dateComparison.sameMonth && daysSinceBeginningOfMonth >= 0;
    if (user.profile[anniversaryprofilefieldid].split(/[./]+/)[2]) {
      if (user.profile[anniversaryprofilefieldid].split(/[./]+/)[2] === dateNow.split(/[./]+/)[2]) return false;
    }
    return dateComparison.sameDate || 
              (dateComparison.daysDiff >= (- showdaysbefore) && dateComparison.daysDiff < 0) || 
              (dateComparison.daysDiff <= showdaysafter && dateComparison.daysDiff > 0);
  });
  filteredUsers.sort((userA,userB) => {
    return compareDates(userA.profile[anniversaryprofilefieldid], userB.profile[anniversaryprofilefieldid], dateformat).daysDiff;
  });

  let htmlList = [];
  if (filteredUsers.length > 0){
    if (includeyear === 'true') {
      usersByGroupCondition = filteredUsers.reduce((arr: {},user) => {
        let yearCount = parseInt(dateNow.substr(6,4)) - parseInt(user.profile[anniversaryprofilefieldid].split(/[./]+/)[2]);
        yearCount = yearCount > 120 ? yearCount - (parseInt(dateNow.substr(6,2))-1)*100 : yearCount;
        arr[yearCount] = arr[yearCount] || [];
        arr[yearCount].push(user);
        return arr;
      },{});

      if(specialyears !== undefined) {
        const specialyearsarr = specialyears.split(',');
        usersByGroupCondition = Object.keys(usersByGroupCondition).filter(yearCount => specialyearsarr.includes(yearCount)).reduce((obj, key) => {
          obj[key] = usersByGroupCondition[key];
          return obj;
        }, {});
      }
    } else {
      usersByGroupCondition = filteredUsers.reduce((arr,user) => {
        const dateComparison = compareDates(user.profile[anniversaryprofilefieldid], dateNow, dateformat),
            dateGroup = dateComparison.sameDate ? '1-today' : dateComparison.daysDiff < 0 ? '0-previous' : '2-upcoming';
        arr[dateGroup] = arr[dateGroup] || [];
        arr[dateGroup].push(user);
        return arr;
      }, {});
      usersByGroupCondition = Object.keys(usersByGroupCondition).sort().reduce((obj, key) => { 
        obj[key] = usersByGroupCondition[key]; 
        return obj;
      },{});
    }

    for (const [groupCondition, usersGroup] of Object.entries(usersByGroupCondition)) {
      if (limit !== undefined) if (anniversariesCount >= limit) return;
      if ( (includeyear === 'true' || daysaftertitle !== undefined || daysbeforetitle !== undefined) && hideyearheader === 'false') {
        htmlList.push(<h2 key={groupCondition} style={hrstyles.container} className="cw-group-condition-title">{groupCondition === '1-today' ? todaytitle : (groupCondition === '2-upcoming' ? daysaftertitle : (groupCondition === '0-previous' ? daysbeforetitle : (groupCondition + " " + (parseInt(groupCondition) > 1 ? yearwordplural : yearword) )))}</h2>)
      }
      htmlList.push(usersGroup.map(
        theUser => {
          const hasAvatar = (typeof(theUser.avatar) !== 'undefined' || imageurl !== undefined);
          const base =
          we.authMgr.getBranchConfig()?.whitelabelConfig?.frontendURL ||
          window.location.origin;      
          const userLink = `${base}/openlink/profile/${theUser.id}`;  

          return (
            <div
              key={theUser.id + 'divInner'}
              id={theUser.id}
              className="cw-entries"
              /* turn the row into a flex-box so we can separate left & right */
              style={{ ...divstyles.container, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              {/* LEFT – avatar + name (unchanged) */}
              <a
                key={theUser.id + 'a'}
                href={userLink}
                className="link-internal ally-focus-within"
                style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
              >
                {hasAvatar ? (
                  <img
                    key={theUser.id + 'img'}
                    data-type="thumb"
                    data-size="35"
                    aria-hidden="true"
                    data-user-id={theUser.id}
                    style={imgstyles.container}
                    src={
                      theUser.avatar
                        ? theUser.avatar.thumb
                          ? theUser.avatar.thumb.url
                          : imageurl
                        : imageurl
                    }
                    alt={theUser.firstName + ' ' + theUser.lastName}
                  />
                ) : (
                  <span
                    key={theUser.id + 'span'}
                    data-type="thumb"
                    data-size="35"
                    aria-hidden="true"
                    data-user-id={theUser.id}
                    style={spanstyles.container}
                  >
                    {theUser.firstName.substr(0, 1) + theUser.lastName.substr(0, 1)}
                  </span>
                )}
          
                <div style={pstyles.container}>
                  <div style={namestyles.container}>
                    {theUser.firstName} {theUser.lastName}
                  </div>
                  <hr style={hrstyles.container} />
                  <span style={datestyles.container}>
                    {showdate === 'true'
                      ? theUser.profile
                        ? convertDate(theUser.profile[anniversaryprofilefieldid], dateformat)
                        : ''
                      : ''}
                  </span>
                </div>
              </a>
          
              {/* RIGHT – chat button (only if enabled) */}
              {linktochat === 'true' && (
                <a
                href={`https://app.staffbase.com/content/chat/6827796988a422758da72069/direct/${theUser.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span
                  className="we-icon css-1ccn5tk-IconStyled e19il6tt0"
                  aria-hidden="true"
                  style={{ fontSize: '20px', paddingRight: '10px' }}
                >
                  D
                </span>
              </a>
            )}
            </div>
          );    
        }))
      anniversariesCount = anniversariesCount + usersGroup.length;
    }
  } else if (!usersAreLoaded){
    htmlList.push(<p key="cw-loading">{loadingmessage}</p>)
  } else {
    htmlList.push(<p key="cw-noinstances">{noinstancesmessage}</p>)
  }


  const contentstyles: { [key: string]: React.CSSProperties } = {
    container: {
      height: numbertoshow + 'px',
      overflow: 'auto',
    },
  };

  const outerstyles: { [key: string]: React.CSSProperties } = {
    container: {
      height: (parseInt(numbertoshow) + 50) + 'px',
      padding: '3px',
    },
  };

  const contentstylesfull: { [key: string]: React.CSSProperties } = {
    container: {
      overflow: 'auto',
    },
  };

  const outerstylesfull: { [key: string]: React.CSSProperties } = {
    container: {
      padding: '3px',
    },
  };

  const hidestyle: { [key: string]: React.CSSProperties } = {
    container: {
      display: 'none',
    },
  };

if (hideemptywidget === 'true' && filteredUsers.length <= 0)
{
return (<div id={"cw-" + anniversaryprofilefieldid} style={hidestyle.container}></div>);
} else{
  return (
    <div id={"cw-" + anniversaryprofilefieldid} style={(numbertoshow !== undefined &&  numbertoshow !== '') ? outerstyles.container : outerstylesfull.container}>
      <h1 id='cw-title' style={h2styles.container}>{title}</h1>
      <div id='cw-list-container' key="userList" style={(numbertoshow !== undefined &&  numbertoshow !== '') ? contentstyles.container : contentstylesfull.container}>{htmlList}</div>
    </div>
  );
}
};

