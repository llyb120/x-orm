import { XManager } from './../../x';
import { ORMCONFIG } from './../../constant';
import { XOrmConfig } from '../../config';
import * as mysql from "mysql";
import { IPool } from "mysql";
import { IDriverBase } from '../driver';
import { EntityDescirption, EntityMap } from '../../decorator/XEntity';
import { FindOption, WhereOption } from '../../repository';
// import { QueryBuilder } from '../../querybuilder';

export class MysqlConnectionManager implements IDriverBase {


    private log(...args: any[]) {
        if (this.config.debug) {
            console.log.call(null, args);
        }
    }

    async count<T>(condition: FindOption<T>, desc: EntityDescirption): Promise<number> {
        const sql = this.buildSql(condition, desc, true);
        const res = await this.query(sql);
        for (const item of res as any[]) {
            for (let i in item) {
                return item[i];
            }
        }
        return 0;
    }

    async delete<T>(condition: WhereOption<T>, desc: EntityDescirption, context?: XManager<T>): Promise<boolean> {
        var str = this.buildWhere(condition, desc, false);
        var sql = `
            delete from \`${this.config.database}\`.\`${this.config.tablesPrefix + desc.tableName}\`
        `;
        if (str != '') {
            sql += ' where ' + str;
        }
        return await this.query(sql, context, desc.database) ? true : false;
    }

    async update<T>(condition: WhereOption<T>, data: T, desc: EntityDescirption, context?: XManager<T>): Promise<any> {
        var str = this.buildWhere(condition, desc, false);
        var sql = `
            update \`${this.config.database}\`.\`${this.config.tablesPrefix + desc.tableName}\`
            set ${(() => {
                var buf = [];
                for (const [key, val] of Object.entries(data)) {
                    var fieldName = '`' + key + '`';
                    if (val == null) {
                        buf.push(`${fieldName} = null`);
                    }
                    else {
                        buf.push(`${fieldName} = '${val}'`);
                    }
                }
                return buf.join(",");
            })()}
        `;
        if (str != '') {
            sql += ' where ' + str;
        }
        this.log(sql)
        return this.query(sql, context, desc.database);
    }

    private buildWhere<T>(whereOption: WhereOption<T>, desc: EntityDescirption, addPrefix = true) {
        var buffer: string[] = [];
        //build and
        if (whereOption.and) {
            var str = this.buildWhere(whereOption.and, desc);
            if (str != '') {
                buffer.push(' and (' + str + ')');
            }
            delete whereOption.and;
        }
        //build or
        if (whereOption.or) {
            var str = this.buildWhere(whereOption.or, desc);
            if (str != '') {
                buffer.push(' or ( ' + str + ')');
            }
            delete whereOption.or;
        }

        for (var name in whereOption) {
            var val = (whereOption as any)[name];
            //添加前缀，防止占用关键字
            var fieldName = (addPrefix ? 't_' + desc.tableName + '.' : "") + name; ``
            if (Array.isArray(val)) {
                if(!val.length){
                    continue;
                }
                //如果数组中使用了entity[]，那么默认使用主键
                if(Object.prototype.isPrototypeOf(val[0])){
                    let desc = EntityMap.get(val[0].__proto__.constructor.name) as EntityDescirption;
                    if(desc){
                        let ids = val.map(item => `'${item[desc.primary]}'`);
                        buffer.push(` and ${fieldName} in (${ids})`);
                        continue;
                    }
                   
                }
                if (val[0] == 'like') {
                    buffer.push(` and ${fieldName} like '${val[1]}'`);
                }
                else if (val[0] == 'in') {
                    if (!Array.isArray(val[1]) || !val[1].length) {
                        buffer.push(` and ${fieldName} in ( -10086 )`);
                    }
                    else {
                        buffer.push(` and ${fieldName} in ( ${val[1].map((item: string) => `'${item}'`).join(',')} )`);
                    }
                }
                else if (val[0] == 'between') {
                    buffer.push(`and ${fieldName} between '${val[1]}' and '${val[2]}'`);
                }
                else if (val[0] == 'notlike') {
                    buffer.push(` and ${fieldName} not like '${val[1]}'`);
                }
                else if (val[0] == 'notin') {
                    if (!Array.isArray(val[1]) || !val[1].length) {
                        buffer.push(` and ${fieldName} not in ( -10086 )`);
                    }
                    else {
                        buffer.push(` and ${fieldName} not in ( ${val[1].map((item: string) => `'${item}'`).join(',')} )`);
                    }
                }
            }
            //聚合查询
            else if (Object.prototype.isPrototypeOf(val)) {
                //如果使用了entity查询，那么当主键可用的情况，直接使用这个entity的主键
                let desc = EntityMap.get(val.__proto__.constructor.name);
                if (desc) {
                    if (val[desc.primary]) {
                        buffer.push(` and ${fieldName} = '${val[desc.primary]}'`);
                        continue;
                    }
                }


                const conditionBuf = [];
                for (var key in val) {
                    let op;
                    switch (key) {
                        case 'lt':
                            conditionBuf.push(`${fieldName} < '${val[key]}'`)
                            break;

                        case 'gt':
                            conditionBuf.push(`${fieldName} > '${val[key]}'`)
                            break;

                        case 'let':
                            conditionBuf.push(`${fieldName} <= '${val[key]}'`)
                            break;

                        case 'get':
                            conditionBuf.push(`${fieldName} >= '${val[key]}'`)
                            break;

                        case 'eq':
                            if (val[key] === null || val[key] === undefined) {
                                conditionBuf.push(`${fieldName} is null`)
                            }
                            else {
                                conditionBuf.push(`${fieldName} = '${val[key]}'`)
                            }
                            break;

                        case 'neq':
                            if (val[key] === null || val[key] === undefined) {
                                conditionBuf.push(`${fieldName} is not null`)
                            }
                            else {
                                conditionBuf.push(`${fieldName} <> '${val[key]}'`)
                            }
                            break;

                        case 'like':
                            conditionBuf.push(`${fieldName} like '${val[key]}'`)
                            break;

                        case 'slike':
                            conditionBuf.push(`${fieldName} like '%${val[key]}%'`)
                            break;

                        case 'in':
                            if (!Array.isArray(val[key]) || !val[key].length) {
                                buffer.push(` and ${fieldName} in ( -10086 )`);
                            }
                            else {
                                buffer.push(` and ${fieldName} in ( ${val[key].map((item: string) => `'${item}'`).join(',')} )`);
                            }
                            break;

                        case 'between':
                            buffer.push(`and ${fieldName} between '${val[key][0]}' and '${val[key][1]}'`);
                            break;

                        case 'notlike':
                            conditionBuf.push(`${fieldName} not like '${val[key]}'`)
                            break;

                        case 'notin':
                            if (!Array.isArray(val[key]) || !val[key].length) {
                                buffer.push(` and ${fieldName} not in ( -10086 )`);
                            }
                            else {
                                buffer.push(` and ${fieldName} not in ( ${val[key].map((item: string) => `'${item}'`).join(',')} )`);
                            }
                            break;
                    }
                }
                if (conditionBuf.length) {
                    buffer.push(' and ' + conditionBuf.join(" and "));
                }
            }
            else {
                if (val == null) {
                    buffer.push(` and ${fieldName} is null`);
                }
                else {
                    buffer.push(` and ${fieldName} = '${val}'`);
                }
            }
        }
        return buffer.join(" ").replace(/^\s*(and|or)/, "").trim();
    }


    public buildSql<T>(findOption: FindOption<T>, desc: EntityDescirption, useCount = false): string {
        var where;
        var group = '';

        /**
         * 追加的字段
         */
        let fieldsBuffer = [];
        if (findOption.extFields) {
            for (const key in findOption.extFields) {
                switch (key) {
                    case 'sum':
                    case 'count':
                    case 'avg':
                        if (!findOption.extFields[key]) {
                            break;
                        }
                        for (const fieldName in (findOption.extFields as any)[key]) {
                            fieldsBuffer.push(`ifnull(${key}(t_${desc.tableName}.${fieldName}),0) as ${(findOption.extFields[key] as any)[fieldName]}`);
                        }
                        break;
                }
            }
        }

        var sql = `
            select ${useCount ? 'count(*)' : "*"} ${fieldsBuffer.length ? "," + fieldsBuffer.join(",") : ""} from \`${this.config.database}\`.\`${this.config.tablesPrefix + desc.tableName}\` as t_${desc.tableName}
        `;
        if (findOption.where) {
            var str = this.buildWhere(findOption.where, desc);
            if (str != '') {
                sql += ' where ' + str;
            }
        }
        if (findOption.group) {
            sql += ' group by ' + `t_${desc.tableName}.${findOption.group}`;
        }
        //默认追加主键
        else{
            sql += ` group by t_${desc.tableName}.${desc.primary}`;
        }
        if (findOption.order) {
            var buf = [];
            for (const name in findOption.order) {
                buf.push(`t_${desc.tableName}.${name} ${findOption.order[name]}`);
            }
            sql += " order by " + buf.join(",");
        }
        if (findOption.limit) {
            if (Array.isArray(findOption.limit)) {
                sql += ' limit ' + findOption.limit[0] + ' , ' + findOption.limit[1];
            }
            else {
                sql += ' limit ' + findOption.limit;
            }
        }
        // console.log(sql);
        this.log(sql)
        return sql;
    }

    async find<T>(findOption: FindOption<T>, desc: EntityDescirption): Promise<T[]> {
        const sql = this.buildSql(findOption, desc);
        var ret;
        ret = await this.query(sql);
        return (ret as T[]) || [];
    }

    async insert<T>(data: T, desc: EntityDescirption, context?: XManager<T>): Promise<T> {
        var fields = [],
            values = [];
        for (const [key, val] of Object.entries(data)) {
            if (typeof val == 'function') continue;
            fields.push(`\`${key}\``);
            if (val == null) {
                values.push('null');
            }
            else {
                values.push(`'${val}'`);
            }
        }
        var dbname = this.config.database;

        var sql = `
            insert into \`${dbname}\`.\`${this.config.tablesPrefix + desc.tableName}\`
                (
                    ${fields.join(",")}
                )
                values
                (
                    ${values.join(",")}
                );
        `;
        var ret = await this.query(sql, context, desc.database);
        (data as any)[desc.primary] = (ret as any).insertId;
        return data;

    }

    public pool: IPool;

    constructor(public config: MysqlConfig) {
        if (!this.config.tablesPrefix) {
            this.config.tablesPrefix = '';
        }
    }

    /**
     * 创建对应的连接池
     */
    start() {
        this.pool = mysql.createPool({
            host: this.config.host,
            user: this.config.username,
            password: this.config.password,
            database: this.config.database,
            port: this.config.port,
            //connectionLimit:100 //最大连接数 
        });
    }


    getConnection(): Promise<mysql.IConnection> {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                // connection.beginTransaction(())
                if (err) {
                    reject(err);
                    return;
                }
                resolve(connection);
            });
        });
    }

    query(sql: string, context?: XManager<any>, database?: string) {
        return new Promise(async (resolve, reject) => {
            /**
             * 事务
             */
            let connection: mysql.IConnection;

            let query = function (connection: mysql.IConnection) {
                connection.query(sql, (err: any, vals: any, fields: any) => {
                    if (!context || !context.inTransition) {
                        connection.release();
                    }
                    else {
                    }
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(vals);
                });
            }

            if (context && context.inTransition && database) {
                if (!context._transitionStroage[database]) {
                    connection = await this.getConnection();
                    context._transitionStroage[database] = connection;
                    //开启事务
                    connection.beginTransaction(err => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        query(connection);
                    });

                }
                else {
                    connection = context._transitionStroage[database];
                    query(connection)
                }
            }
            else {
                connection = await this.getConnection();
                query(connection);
            }


            // this.pool.getConnection((err, connection) => {
            //     if (err) {
            //         connection.release();
            //         reject(err);
            //         return;
            //     }
            //     connection.query(sql, (err, vals, fields) => {
            //         if (err) {
            //             connection.release();
            //             reject(err)
            //             return;
            //         }
            //         connection.release();
            //         resolve(vals);
            //     })
            // });
        })
    }

    roolback(connection: mysql.IConnection) {
        return new Promise((resolve, reject) => {
            (connection as mysql.IConnection).rollback(() => {
                connection.release();
                resolve();
            });
        });
    }

    commit(connection: mysql.IConnection) {
        return new Promise((resolve, reject) => {
            (connection as mysql.IConnection).commit(() => {
                connection.release();
                resolve();
            });
        });
    }


}

export interface MysqlConfig {
    type: 'mysql',
    name: "default" | string,
    host: string,
    port: number,
    username: string,
    password: string,
    database: string,
    tablesPrefix?: string;
    debug?: boolean;
}