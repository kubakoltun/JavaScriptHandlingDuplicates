const hubspot = require('@hubspot/api-client');

const DUPLICAT_PROPERTY = 'lastname';
//firstname && lastname
const ACTIVITY_PROPERTY = 'notes_last_updated';

exports.main = (event) => {

  const hubspotClient = new hubspot.Client({ accessToken: process.env.nsc });
  
  hubspotClient.crm.contacts.basicApi
    .getById(event.object.objectId, [DUPLICAT_PROPERTY])
    .then(contactResult => {
      let duplicatPropValue = contactResult.properties[DUPLICAT_PROPERTY];

      console.log(`Looking for duplicates based on ${DUPLICAT_PROPERTY} = ${duplicatPropValue}`);
      hubspotClient.crm.contacts.searchApi
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
            .filter(vid => Number(vid) !== Number(event.object.objectId));

          if (idsToMerge.length == 0) {
            console.log('No matching contact, nothing to merge');
            return;
          } 
          else if (idsToMerge.length > 1) {
            console.log(`Found multiple potential contact IDs ${idsToMerge.join(', ')} to merge`);
            throw new Error("Ambiguous merge; more than one matching contact");
          }
        
          let idToMerge = idsToMerge[0];
          let idMergedInto = event.object.objectId;

          //in case of not epmty dates next step is to compare last notes dates
          if (idsToMerge[0] > event.object.objectId) {
            idToMerge = idsToMerge[0];
            idMergedInto = event.object.objectId;
          } 
          else if (idsToMerge[0] < event.object.objectId) {
            idToMerge = event.object.objectId;
            idMergedInto = idsToMerge[0];
          }

          console.log(`id0 ${idToMerge} `);
          console.log(`id1 ${idMergedInto} `);

          hubspotClient.crm.contacts.basicApi.getById(idToMerge, [ACTIVITY_PROPERTY], undefined, undefined, false)
            .then(contact0Result => {
               let lastmodPropVal0 = contact0Result.properties[ACTIVITY_PROPERTY]; 
               console.log(`last act string0 ${lastmodPropVal0}`);
            
               hubspotClient.crm.contacts.basicApi.getById(idMergedInto, [ACTIVITY_PROPERTY], undefined, undefined, false)
                 .then(contact1Result => {
                   let lastmodPropVal1 = contact1Result.properties[ACTIVITY_PROPERTY]; 
                   console.log(`last act string1 ${lastmodPropVal1}`);

                 //merging by the dates cryteria only 
                   if (lastmodPropVal1 == "undefined" && lastmodPropVal0 == "undefined") {
                      throw new Error("Unable to decide which contact should be superior");
                   }
                   else if (lastmodPropVal1 == "undefined") {
                      //{}
                   }
                   else if (lastmodPropVal0 == "undefined") {
                        let temp = 0;
                        temp = idToMerge;
                        idToMerge = idMergedInto;
                        idMergedInto = temp;
                   }
                   else {
                     let data0 = new Date(lastmodPropVal0);
                     console.log(`data0 ${data0}`);
                     let data1 = new Date(lastmodPropVal1);
                     console.log(`data1 ${data1}`);
                     if (data0 < (new Date(data1.setDate(new Date().getDate()-90))) || data1 < (new Date(data0.setDate(new Date().getDate()-90)))) {
                       if (data0 < data1) {
                         let temp = 0;
                         temp = idToMerge;
                         idToMerge = idMergedInto;
                         idMergedInto = temp;
                       }
                       //merge
                       console.log(`after swap id0 ${idToMerge} gets merged`);
                       console.log(`after swap id1 ${idMergedInto} superior`);

                       console.log(`Merging enrolled contact id1=${idMergedInto} into contact id0=${idToMerge}`);
                       hubspotClient
                         .apiRequest({
                         method: 'POST',
                         path: `/contacts/v1/contact/merge-vids/${idToMerge}`,
                         body: {
                           vidToMerge: idMergedInto
                         }
                       })
                         .then(mergeResult => {
                         console.log('Contacts merged!');
                       });
                       //merge
                    } 
                    else {
                    throw new Error("Unable to decide which contact should be superior");
                    }
                  }
                 //merging by the dates cryteria only 
				});
			});
        });
	});
};
