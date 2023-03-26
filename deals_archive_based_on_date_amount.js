const hubspot = require('@hubspot/api-client');

const DUPLICAT_PROPERTY = 'hubspot_owner_id';
const ACTIVITY_PROPERTY = [ "amount" , "createdate" ];
const ACTIVITY_PROPERTY_DATE = 'createdate';

exports.main = (event) => {

  const hubspotClient = new hubspot.Client({ accessToken: process.env.nsc });
  
  hubspotClient.crm.deals.basicApi
    .getById(event.object.objectId, [DUPLICAT_PROPERTY])
    .then(dealResult => {
      let duplicatPropValue = dealResult.properties[DUPLICAT_PROPERTY];
      console.log(`Looking for duplicates based on ${DUPLICAT_PROPERTY} = ${duplicatPropValue}`);
      hubspotClient.crm.deals.searchApi
        .doSearch({
          filterGroups: [{
            filters: [{
              propertyName: DUPLICAT_PROPERTY,
              operator: 'EQ',
              value: duplicatPropValue
            }]
          }]
        })
          .then(searchResults => {
          let idsToMerge = searchResults.results
            .map(object => object.id)
            .filter(vid => Number(vid) !== Number(event.object.objectId))
          
          let idsToMergeAll = searchResults.results
            .map(object => object.id);

          if (idsToMerge.length == 0) {
            console.log('No matching deal, nothing to merge');
            return;
          }
          else if (idsToMerge.length > 1) {
            console.log(`Found multiple potential deal IDs ${idsToMerge.join(', ')} to merge`);

            let dealToParse = "";
            let cdateHold = '2000-01-09T11:52:40.522Z';
            let cdateMax = new Date(cdateHold);
            let searchForMax = idsToMergeAll[0];
            let cdateConversion = 0;
            let newIdsToMerge = [];

            for (let i = 0; i < idsToMergeAll.length; i++) {
              hubspotClient.crm.deals.basicApi.getById(idsToMergeAll[i], ACTIVITY_PROPERTY, undefined, undefined, false) 
                .then(result => {
                  let cdate0 = result.properties.createdate;
                  let amount = result.properties.amount;

                  cdateConversion = new Date(cdate0);
                  let yesterday = new Date(new Date().setDate(new Date().getDate()-1));

                  if (cdateConversion > yesterday) {
                    for (let inL = 0; inL < idsToMergeAll.length; inL++) { 
                      let async_fun = async function() {
                        try {
                          const resWew = await                                               hubspotClient.crm.deals.basicApi.getById(idsToMergeAll[inL], ACTIVITY_PROPERTY, undefined, undefined, false);
                          let lookingForAmount1 = resWew.properties.amount; 
                          if (lookingForAmount1 == amount && inL != i) {
                            if (cdateConversion > cdateMax) {
                              searchForMax = idsToMergeAll[i];
                              cdateMax = cdateConversion;
                            }
                            if (idsToMergeAll[i] == newIdsToMerge[newIdsToMerge.length-1]) {
                              //{}
                            }
                            else {
                              newIdsToMerge.push(idsToMergeAll[i]);
                            }
                          }
                        }
                        catch (e) {
                          throw e;
                        }
                      }
                      async_fun();
                    }
                  }
                });          
            }
            setTimeout(() => {
              for (let j = 0; j < newIdsToMerge.length; j++) {
                if (newIdsToMerge[j] === searchForMax) {
                  //{}
                } 
                else {
                  dealToParse = `{"id":"${newIdsToMerge[j]}"}`;
                  console.log(`deal to parse and delete: ${dealToParse}`);
                  let objJson = JSON.parse(dealToParse);
                  const BatchInputSimplePublicObjectId = { inputs: [objJson] };
                  hubspotClient.crm.deals.batchApi.archive(BatchInputSimplePublicObjectId)
                }
              }
            }, "10000")
          console.log(`Multile deals archived - ${newIdsToMerge}`);
          return;
        }  
        
        let idToMerge = idsToMerge[0];
        let idMerged1 = event.object.objectId;
              
        if (idsToMerge[0] > event.object.objectId) {
          idToMerge = idsToMerge[0];
          idMerged1 = event.object.objectId;
        } 
        else if (idsToMerge[0] < event.object.objectId) {
          idToMerge = event.object.objectId;
          idMerged1 = idsToMerge[0];
        }
        
        hubspotClient.crm.deals.basicApi.getById(idToMerge, ACTIVITY_PROPERTY, undefined, undefined, false)
          .then(dealResult0 => {
            let cdatePropVal0 = dealResult0.properties[ACTIVITY_PROPERTY_DATE]; 
            let amount0 = dealResult0.properties.amount;

            hubspotClient.crm.deals.basicApi.getById(idMerged1, ACTIVITY_PROPERTY, undefined, undefined, false)
            .then(dealResult1 => {
              let cdatePropVal1 = dealResult1.properties[ACTIVITY_PROPERTY_DATE];      
              let amount1 = dealResult1.properties.amount;
              
              let data0 = new Date(cdatePropVal0);
              let data1 = new Date(cdatePropVal1);   
              
              if ((data1 > data0 && data0 > (new Date(new Date().setDate(data1.getDate()-2)))) || (data0 > data1 && data1 > (new Date(new Date().setDate(data0.getDate()-2))))) {
                if (amount0 == amount1) {
                  if (data0 > data1) {
                      let temp = 0;
                      temp = idToMerge;
                      idToMerge = idMerged1;
                      idMerged1 = temp;
                  }

                  let id0 = "";
                  let id1 = "";
                  id0 += idToMerge;
                  id1 += idMerged1;

                  hubspotClient.apiRequest({
                    method: 'POST',
                    path: '/crm/v3/objects/deals/merge',
                    body: {
                      primaryObjectId: id0,
                      objectIdToMerge: id1
                    }
                  });
                  console.log(`Deal archived`);
                }
                else {
                  console.log(`Deals have a diffrent amount, not a duplicate`);
                  return;
                }
              }
              else {
                console.log(`Deals created too far apart, not a duplicate`);
                return;
              }
              
         });
   });
  });
 });
}
