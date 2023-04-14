const { instance } = require("./DCM4CHEE_APIConfig");
// const POST_DCM4CHEE_workitems = async (dicomTagData) => {};

const POST_DCM4CHEE_workitems = (dicomTagData) =>
  instance.post("workitems", dicomTagData);

const POST_DCM4CHEE_mwlitems = (dicomTagData) =>
  instance.post("mwlitems", dicomTagData);

// const POST_DCM4CHEE_workitems = async (dicomTagData) => {
//   const headers = {
//     Accept: "application/dicom+json",
//     "Content-Type": "application/dicom+json",
//   };
//   return await axios.post(
//     process.env.WORKLIST_API_URL + "workitems",
//     dicomTagData,
//     { headers }
//   );
// };

// const POST_DCM4CHEE_mwlitems = async (dicomTagData) => {
//   const headers = {
//     Accept: "application/dicom+json",
//     "Content-Type": "application/dicom+json",
//   };
//   return await axios.post(
//     process.env.WORKLIST_API_URL + "mwlitems",
//     dicomTagData,
//     { headers }
//   );
// };

module.exports = { POST_DCM4CHEE_workitems, POST_DCM4CHEE_mwlitems };
