import { XEntityConfig } from '../header/config';
import { ORMCONFIG } from '../constant';
import { ObjectType } from "../header/ObjectType";


export var EntityMap = new Map<Object,EntityDescirption>();

/**
 * 默认的
 * @param target 
 */
export function XEntity(target : Function) : void;
/**
 * 归属于哪个数据库，默认为default
 * @param from 
 */
export function XEntity(from? : string) :Function;

export function XEntity(config? : XEntityConfig) : Function;

export function XEntity(first? : Function | string | XEntityConfig) : any{
    var type = 'default';
    var final = function(target : Function){
        var info : EntityDescirption ;
        if(!EntityMap.has(target.prototype)){
            info = InitEntityDescirption();
            EntityMap.set(target.prototype,info);
        }
        else{
            info = EntityMap.get(target.prototype) as EntityDescirption;
        }
        info.database = type;
        info.tableName = target.name.replace(/^[A-Z]/,function(a){
            return a.toLowerCase();
        }).replace(/[A-Z][a-z]/g,function(a){
            return '_' + a.toLowerCase();
        });
        console.log(123)
        console.log(EntityMap );

        //大概会用到吧
        ORMCONFIG.MODELS[type] = ORMCONFIG.MODELS[type] || [];
        ORMCONFIG.MODELS[type].push(target);
    }
    if(first){
        if(typeof first == 'function'){
            
            return;
        }
        else{
            return final;
        }
    }
    return final;
    // function(target : Function){
        // ORMCONFIG[type] = ORMCONFIG[type]
    // }
}

export interface EntityDescirption{
    fields : any[],
    primary : string,
    database : string;
    tableName : string;
}

export function InitEntityDescirption() : EntityDescirption{
    return {
        fields : [],
        primary : 'id',
        database : 'default',
        tableName : ''   
    } 
}

export type Entity<T> = ObjectType<T>;