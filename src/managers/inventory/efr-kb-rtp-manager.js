'use strict';

// external deps 
var ObjectId = require('mongodb').ObjectId;

// internal deps
require('mongodb-toolkit');
var BateeqModels = require('bateeq-models');
var generateCode = require('../../utils/code-generator');
var map = BateeqModels.map;

var TransferOutDoc = BateeqModels.inventory.TransferOutDoc;
var TransferOutItem = BateeqModels.inventory.TransferOutItem;

var moduleId = "EFR-KB/RTP";

module.exports = class TokoKirimBarangReturnManager {
    constructor(db, user) {
        this.db = db;
        this.user = user;
        this.transferOutDocCollection = this.db.use(map.inventory.TransferOutDoc);
        var StorageManager = require('./storage-manager');
        this.storageManager = new StorageManager(db, user);

        var ArticleVariantManager = require('../core/article/article-variant-manager');
        this.articleVariantManager = new ArticleVariantManager(db, user);

        var InventoryManager = require('./inventory-manager');
        this.inventoryManager = new InventoryManager(db, user);

        var TransferOutDocManager = require('./transfer-out-doc-manager');
        this.transferOutDocManager = new TransferOutDocManager(db, user);

        var ModuleManager = require('../core/module-manager');
        this.moduleManager = new ModuleManager(db, user);
    }

    read(paging) {
        var _paging = Object.assign({
            page: 1,
            size: 20,
            order: '_id',
            asc: true
        }, paging);

        return new Promise((resolve, reject) => {
            var regexModuleId = new RegExp(moduleId, "i");
            var filter = {
                _deleted: false,
                'code': {
                    '$regex': regexModuleId
                }
            };
            var query = _paging.keyword ? {
                '$and': [filter]
            } : filter;

            if (_paging.keyword) {
                var regex = new RegExp(_paging.keyword, "i");
                var filterCode = {
                    'code': {
                        '$regex': regex
                    }
                };
                var $or = {
                    '$or': [filterCode]
                };

                query['$and'].push($or);
            }


            this.transferOutDocCollection
                .where(query)
                .page(_paging.page, _paging.size)
                .orderBy(_paging.order, _paging.asc)
                .execute()
                .then(transferOutDocs => {
                    resolve(transferOutDocs);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getById(id) {
        return new Promise((resolve, reject) => {
            var query = {
                _id: new ObjectId(id),
                _deleted: false
            };
            this.getSingleByQuery(query)
                .then(transferOutDoc => {
                    resolve(transferOutDoc);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getByIdOrDefault(id) {
        return new Promise((resolve, reject) => {
            var query = {
                _id: new ObjectId(id),
                _deleted: false
            };
            this.getSingleOrDefaultByQuery(query)
                .then(transferOutDoc => {
                    resolve(transferOutDoc);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getSingleByQuery(query) {
        return new Promise((resolve, reject) => {
            this.transferOutDocCollection
                .single(query)
                .then(transferOutDoc => {
                    resolve(transferOutDoc);
                })
                .catch(e => {
                    reject(e);
                });
        })
    }

    getSingleOrDefaultByQuery(query) {
        return new Promise((resolve, reject) => {
            this.transferOutDocCollection
                .singleOrDefault(query)
                .then(transferOutDoc => {
                    resolve(transferOutDoc);
                })
                .catch(e => {
                    reject(e);
                });
        })
    }

    create(transferOutDoc) {
        return new Promise((resolve, reject) => {
            this._validate(transferOutDoc)
                .then(validTransferOutDoc => {
                    validTransferOutDoc.code = generateCode(moduleId);
                    this.transferOutDocManager.create(validTransferOutDoc)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })

        });
    }

    update(transferOutDoc) {
        return new Promise((resolve, reject) => {
            this._validate(transferOutDoc)
                .then(validTransferOutDoc => {
                    this.transferOutDocManager.update(validTransferOutDoc)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(ex => {
                            reject(ex);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    delete(transferOutDoc) {
        return new Promise((resolve, reject) => {
            this._validate(transferOutDoc)
                .then(validTransferOutDoc => {
                    validTransferOutDoc._deleted = true;
                    this.transferOutDocManager.update(validTransferOutDoc)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    _validate(transferOutDoc) {
        return new Promise((resolve, reject) => {
            var valid = transferOutDoc;
            this.moduleManager.getByCode(moduleId)
                .then(module => {
                    var config = module.config;
                    if (!valid.sourceId || valid.sourceId == '')
                        errors["sourceId"] = "sourceId is required";
                    else {
                        if (config) {
                            if (config.source) {
                                var isAny = false;
                                if (config.source.type == "selection") {
                                    for (var sourceId of config.source.value) {
                                        if (sourceId.toString() == valid.sourceId.toString()) {
                                            isAny = true;
                                            break;
                                        }
                                    }
                                }
                                else {
                                    if (config.source.value.toString() == valid.sourceId.toString())
                                        isAny = true;
                                }
                                if (!isAny)
                                    errors["sourceId"] = "sourceId is not valid";
                            }
                        }
                    }

                    if (!valid.destinationId || valid.destinationId == '')
                        errors["destinationId"] = "destinationId is required";
                    else {
                        if (config) {
                            if (config.destination) {
                                var isAny = false;
                                if (config.destination.type == "selection") {
                                    for (var destinationId of config.destination.value) {
                                        if (destinationId.toString() == valid.destinationId.toString()) {
                                            isAny = true;
                                            break;
                                        }
                                    }
                                }
                                else {
                                    if (config.destination.value.toString() == valid.destinationId.toString())
                                        isAny = true;
                                }
                                if (!isAny)
                                    errors["destinationId"] = "destinationId is not valid";
                            }
                        }
                    }
                    resolve(valid);
                })
                .catch(e => {
                    reject(new Error(`Unable to load module:${moduleId}`));
                });
        });
    }
}; 