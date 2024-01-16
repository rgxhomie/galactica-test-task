const fs = require('fs');
const path = require('path');

// 63199073

const SUCCESS_STATUS = 'SUCCESS';
const FAILURE_STATUS = 'FAILURE';
const ROOT_DIR = __dirname;
const APPLICATION_DIR = path.join(ROOT_DIR, 'application');
const FOLDER_STRUCTURE = [
    '_File Review Folder', 
    '1 - Client Correspondence', 
    '2 - IDF, App as Filled (read-only), FFL',
    '3 - IFW (Fillings and PTO Correspondence)',
    '4 - Refs (IDS refs, IDS Checks, 892 Refs used in Rejections)',
    '5 - Archive'
];


const getApplicationNumber = () => {
    const param = process.argv[2];
    if (!param) return false;

    const digitFormatRegex = /^\d{8}$/;
    const applFormatRegex = /^\d{2}\/\d{3},\d{3}$/;

    if (digitFormatRegex.test(param)) return param;

    if (applFormatRegex.test(param)) {
        return param.replace(/\D/g, '');
    }

    return false;
}

const getApplication = async (appNumber) => {
    try {
        const applicationDataResponse = await fetch(`https://patentcenter.uspto.gov/retrieval/public/v2/application/data?applicationNumberText=${appNumber}`)
        const applicationData = await applicationDataResponse.json();

        return applicationData;
    } catch (error) {
        console.log('Error occured while checking the application number: ', {error});

        return false;
    }
}

const createFolderStructure = async (applicationData) => {
    fs.mkdirSync(APPLICATION_DIR);

    const applPromise = fs.writeFile(
        path.join(APPLICATION_DIR, 'application.json'), 
        JSON.stringify(applicationData, null, 4),
        (e) => console.log({e})
    );

    const structPromise = FOLDER_STRUCTURE.map(folderName => fs.mkdir(
            path.join(APPLICATION_DIR, folderName), 
            (e) => console.log({e})
        ));

    return Promise.all([applPromise, ...structPromise]);
}

const downloadFiles = async (dir, applNum) => {
    const docsMetaResponse = await fetch(`https://patentcenter.uspto.gov/retrieval/public/v1/applications/sdwp/external/metadata/${applNum}`);
    const docsMeta = await docsMetaResponse.json();
    fs.writeFileSync('meta.json', JSON.stringify(docsMeta, null, 4))
    if (docsMeta?.errorBag?.length) return false;

    return docsMeta.resultBag[0].documentBag.map(async (doc, idx) => {
        return fetch(`https://ped.uspto.gov/api/queries/cms/pdfDocument/${applNum}/${doc.documentIdentifier}`)
        .then(r => r.text())
        .then(t => {
            fs.writeFile(
                path.join(dir, `${doc.documentDescription}.${doc.mimeTypeBag[0]}`),
                t,
                (e) => console.log({e})
            );
        });
    });
}

const main = async () => {
    const applicationNumber = getApplicationNumber();

    if (!applicationNumber) {
        console.log(`Application number must be passed as a first parameter.`);

        return;
    }
    
    const applicationData = await getApplication(applicationNumber);

    if (applicationData.status === FAILURE_STATUS || applicationData.status !== SUCCESS_STATUS) {
        console.log(`Application with number ${applicationNumber} couldn't be found.`);

        return;
    }

    await createFolderStructure(applicationData);

    await downloadFiles(path.join(APPLICATION_DIR, FOLDER_STRUCTURE[0]));
}

main();