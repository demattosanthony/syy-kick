## search in specific folder
```
https://graph.microsoft.com/v1.0/sites/setty.sharepoint.com,1df50ed0-d744-4d9d-a63b-ab3ce3b55e37,e7db0180-4a64-4552-9ae5-d8857637ea01/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP/58800c91-af97-4ee8-9252-4529f74074c9-DeepakGowda:/search(q='Arbor')
```

### Response
```
{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#Collection(microsoft.graph.driveItem)",
    "value": [
        {
            "createdDateTime": "2023-03-28T07:34:43Z",
            "id": "01NBEHHPD7OIGNYYG2DRC2UCAO5N2HLHA6",
            "lastModifiedDateTime": "2023-03-28T07:34:43Z",
            "name": "Arbor Hills RFP for Architecture 230310 - G Alvarez_REVISED.pdf",
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/58800c91-af97-4ee8-9252-4529f74074c9-DeepakGowda/Arbor%20Hills%20RFP%20for%20Architecture%20230310%20-%20G%20Alvarez_REVISED.pdf",
            "size": 3674461,
            "createdBy": {
                "user": {
                    "email": "",
                    "displayName": "Guest Contributor"
                }
            },
            "lastModifiedBy": {
                "user": {
                    "email": "",
                    "displayName": "Guest Contributor"
                }
            },
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPBYRYBMM4CCNNDKML4O7HLWGYLX",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "file": {
                "mimeType": "application/pdf",
                "hashes": {}
            },
            "fileSystemInfo": {
                "createdDateTime": "2023-03-28T07:34:43Z",
                "lastModifiedDateTime": "2023-03-28T07:34:43Z"
            },
            "searchResult": {}
        }
    ]
}

```


## get folder content
```
https://graph.microsoft.com/v1.0/sites/setty.sharepoint.com,1df50ed0-d744-4d9d-a63b-ab3ce3b55e37,e7db0180-4a64-4552-9ae5-d8857637ea01/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP:/children
```

### Response
```
{
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#Collection(driveItem)",
    "value": [
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:26:36Z",
            "eTag": "\"{C34105D9-484A-4AAF-BBB4-5FB438D2B15E},1\"",
            "id": "01NBEHHPGZAVA4GSSIV5FLXNC7WQ4NFMK6",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:26:36Z",
            "name": "1bed7834-5cc9-4038-a989-7957ca58b3c3-Ahmed",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/1bed7834-5cc9-4038-a989-7957ca58b3c3-Ahmed",
            "cTag": "\"c:{C34105D9-484A-4AAF-BBB4-5FB438D2B15E},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:26:36Z",
                "lastModifiedDateTime": "2023-03-27T15:26:36Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-05-12T12:51:22Z",
            "eTag": "\"{1A801F50-ACA0-42A5-AB18-0B563FEF25F8},1\"",
            "id": "01NBEHHPCQD6ABVIFMUVBKWGALKY766JPY",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-05-12T12:51:22Z",
            "name": "41d615a3-6fe3-4289-baa2-748447c05b16-Suraj",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/41d615a3-6fe3-4289-baa2-748447c05b16-Suraj",
            "cTag": "\"c:{1A801F50-ACA0-42A5-AB18-0B563FEF25F8},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-05-12T12:51:22Z",
                "lastModifiedDateTime": "2023-05-12T12:51:22Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-04-25T11:53:25Z",
            "eTag": "\"{CD508B55-B6A4-475B-9FD2-B804CEA5D83F},1\"",
            "id": "01NBEHHPCVRNIM3JFWLNDZ7UVYATHKLWB7",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-04-25T11:53:25Z",
            "name": "4ffcda1d-ad34-4407-a0df-cc75b12de15a-HanshikaKumari",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/4ffcda1d-ad34-4407-a0df-cc75b12de15a-HanshikaKumari",
            "cTag": "\"c:{CD508B55-B6A4-475B-9FD2-B804CEA5D83F},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-04-25T11:53:25Z",
                "lastModifiedDateTime": "2023-04-25T11:53:25Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-28T07:33:10Z",
            "eTag": "\"{C6028E38-4270-466B-A62F-8EF9D7636177},1\"",
            "id": "01NBEHHPBYRYBMM4CCNNDKML4O7HLWGYLX",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-28T07:33:10Z",
            "name": "58800c91-af97-4ee8-9252-4529f74074c9-DeepakGowda",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/58800c91-af97-4ee8-9252-4529f74074c9-DeepakGowda",
            "cTag": "\"c:{C6028E38-4270-466B-A62F-8EF9D7636177},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-28T07:33:10Z",
                "lastModifiedDateTime": "2023-03-28T07:33:10Z"
            },
            "folder": {
                "childCount": 2
            },
            "shared": {
                "scope": "users"
            },
            "size": 3964457
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-04-03T13:11:52Z",
            "eTag": "\"{52D062EE-C49D-4E1F-A403-6A1EBBC48CAE},1\"",
            "id": "01NBEHHPHOMLIFFHOED5HKIA3KD254JDFO",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-04-03T13:11:52Z",
            "name": "67db779f-612c-4375-bbb4-c4052359656f-Nikhil",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/67db779f-612c-4375-bbb4-c4052359656f-Nikhil",
            "cTag": "\"c:{52D062EE-C49D-4E1F-A403-6A1EBBC48CAE},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-04-03T13:11:52Z",
                "lastModifiedDateTime": "2023-04-03T13:11:52Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-28T07:45:55Z",
            "eTag": "\"{160C86F3-D423-4059-89DE-CFC2C8C3082B},1\"",
            "id": "01NBEHHPHTQYGBMI6ULFAITXWPYLEMGCBL",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-28T07:45:55Z",
            "name": "6b5ff6ae-330a-413e-a499-e1911d613242-xyz",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/6b5ff6ae-330a-413e-a499-e1911d613242-xyz",
            "cTag": "\"c:{160C86F3-D423-4059-89DE-CFC2C8C3082B},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-28T07:45:55Z",
                "lastModifiedDateTime": "2023-03-28T07:45:55Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:33:43Z",
            "eTag": "\"{68A84FF8-2B24-4D2F-BBBE-7CBFF55FFCB3},1\"",
            "id": "01NBEHHPHYJ6UGQJBLF5G3XPT4X72V77FT",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:33:43Z",
            "name": "8030e780-8a16-46a2-aaeb-f5f6afac0c58-Wasim5",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/8030e780-8a16-46a2-aaeb-f5f6afac0c58-Wasim5",
            "cTag": "\"c:{68A84FF8-2B24-4D2F-BBBE-7CBFF55FFCB3},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:33:43Z",
                "lastModifiedDateTime": "2023-03-27T15:33:43Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:35:33Z",
            "eTag": "\"{89FB77AC-865B-4343-B8AA-9E861C4FB4CE},1\"",
            "id": "01NBEHHPFMO75YSW4GINB3RKU6QYOE7NGO",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:35:33Z",
            "name": "a0b89456-e5a0-46ce-b5d7-5259a86b998f-Nikhil",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/a0b89456-e5a0-46ce-b5d7-5259a86b998f-Nikhil",
            "cTag": "\"c:{89FB77AC-865B-4343-B8AA-9E861C4FB4CE},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:35:33Z",
                "lastModifiedDateTime": "2023-03-27T15:35:33Z"
            },
            "folder": {
                "childCount": 1
            },
            "shared": {
                "scope": "users"
            },
            "size": 14821
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-28T05:40:44Z",
            "eTag": "\"{44D022F9-8581-455C-8700-DCBA7A4C3A9F},1\"",
            "id": "01NBEHHPHZELIEJAMFLRCYOAG4XJ5EYOU7",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-28T05:40:44Z",
            "name": "b8c0cafe-2078-4571-b4b3-894d22fe35ba-ShashishekharS",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/b8c0cafe-2078-4571-b4b3-894d22fe35ba-ShashishekharS",
            "cTag": "\"c:{44D022F9-8581-455C-8700-DCBA7A4C3A9F},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-28T05:40:44Z",
                "lastModifiedDateTime": "2023-03-28T05:40:44Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:14:23Z",
            "eTag": "\"{3CCBE118-809A-4B41-8958-A6D875B8C9A7},1\"",
            "id": "01NBEHHPAY4HFTZGUAIFFYSWFG3B23RSNH",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:14:23Z",
            "name": "bdf111e0-4e43-4247-a83d-9ef0183c3f0f-Nikhil",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/bdf111e0-4e43-4247-a83d-9ef0183c3f0f-Nikhil",
            "cTag": "\"c:{3CCBE118-809A-4B41-8958-A6D875B8C9A7},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:14:23Z",
                "lastModifiedDateTime": "2023-03-27T15:14:23Z"
            },
            "folder": {
                "childCount": 1
            },
            "shared": {
                "scope": "users"
            },
            "size": 14821
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:03:11Z",
            "eTag": "\"{776D2594-19A2-4D98-A04A-B8027AD3B691},1\"",
            "id": "01NBEHHPEUEVWXPIQZTBG2ASVYAJ5NHNUR",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:03:11Z",
            "name": "d50e217a-1c84-4fee-9542-c655142e6f2b-WasimAhmed",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/d50e217a-1c84-4fee-9542-c655142e6f2b-WasimAhmed",
            "cTag": "\"c:{776D2594-19A2-4D98-A04A-B8027AD3B691},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:03:11Z",
                "lastModifiedDateTime": "2023-03-27T15:03:11Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:10:07Z",
            "eTag": "\"{FC2B3159-B951-4934-B90A-6B50C0AE4315},1\"",
            "id": "01NBEHHPCZGEV7YUNZGRE3SCTLKDAK4QYV",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:10:07Z",
            "name": "dec721a4-53e4-4322-9b1b-5263efaecd55-Wasim",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/dec721a4-53e4-4322-9b1b-5263efaecd55-Wasim",
            "cTag": "\"c:{FC2B3159-B951-4934-B90A-6B50C0AE4315},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:10:07Z",
                "lastModifiedDateTime": "2023-03-27T15:10:07Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-09-14T06:38:13Z",
            "eTag": "\"{5C22208B-9241-4D13-BDD4-903FCC8F1271},1\"",
            "id": "01NBEHHPELEARFYQMSCNG33VEQH7GI6ETR",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-09-14T06:38:13Z",
            "name": "ded2e8cb-100c-4360-b971-dae6e399ad87-sdf",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/ded2e8cb-100c-4360-b971-dae6e399ad87-sdf",
            "cTag": "\"c:{5C22208B-9241-4D13-BDD4-903FCC8F1271},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-09-14T06:38:13Z",
                "lastModifiedDateTime": "2023-09-14T06:38:13Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        },
        {
            "createdBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "createdDateTime": "2023-03-27T15:57:55Z",
            "eTag": "\"{E3C1B779-8525-46C8-86C4-6E62872E3E8E},1\"",
            "id": "01NBEHHPDZW7A6GJMFZBDINRDOMKDS4PUO",
            "lastModifiedBy": {
                "application": {
                    "id": "b5132cc3-9df7-4b0e-80be-da866d6b5357",
                    "displayName": "BEPSAuth"
                },
                "user": {
                    "displayName": "SharePoint App"
                }
            },
            "lastModifiedDateTime": "2023-03-27T15:57:55Z",
            "name": "f448545c-2817-460f-9f0e-97693d31229e-SierraNguyen",
            "parentReference": {
                "driveType": "documentLibrary",
                "driveId": "b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA",
                "id": "01NBEHHPCKVVO6CKE7WZDYUBQECWKE2Q5N",
                "name": "BEPS-APP",
                "path": "/drives/b!0A71HUTXnU2mO6s847VeN4AB2-dkSlJFmuXYhXY36gH8aZFiSq8FS5agsWCuP9xA/root:/BEPS-APP",
                "siteId": "1df50ed0-d744-4d9d-a63b-ab3ce3b55e37"
            },
            "webUrl": "https://setty.sharepoint.com/Shared%20Documents/BEPS-APP/f448545c-2817-460f-9f0e-97693d31229e-SierraNguyen",
            "cTag": "\"c:{E3C1B779-8525-46C8-86C4-6E62872E3E8E},0\"",
            "fileSystemInfo": {
                "createdDateTime": "2023-03-27T15:57:55Z",
                "lastModifiedDateTime": "2023-03-27T15:57:55Z"
            },
            "folder": {
                "childCount": 0
            },
            "shared": {
                "scope": "users"
            },
            "size": 0
        }
    ]
}
```