import { css, CSSResult, html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js'
import { DateTime } from 'luxon';
import { HomeAssistant } from 'custom-card-helpers';

import ItsclockConfig from './ItsclockConfig';
import { Ephemeris } from './ephemeris_class'
import { version, name } from '../package.json'

console.info(
  `%c  ${name.toUpperCase()}  %c  Version ${version}  `,
    'color: white; font-weight: bold; background: crimson',
    'color: #000; font-weight: bold; background: #ddd',
);


  // Allow this card to appear in the card chooser menu
  export interface WindowWithCards extends Window {
    customCards: unknown[];
  }

const windowWithCards = window as unknown as WindowWithCards;
windowWithCards.customCards = windowWithCards.customCards || [];
windowWithCards.customCards.push({
    type: 'tsclock-card',
    name: "tsclock-card",
    preview: true,
    description: "A simple clock component"
});



@customElement('tsclock-card')
export class Tsclock extends LitElement {
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private _firstLine = '';
    @state() private _secondLine = '';
    @state() private _thirdLine = '';
    @state() private _config?: ItsclockConfig;
    @state() private _interval = 1000;
    private _intervalId?: number;

    public setConfig(config: ItsclockConfig): void {
        this._config = {...config};
        if (this._config.timeFormat)
            this._config.firstLineFormat = this._config.timeFormat;
        if (this._config.dateFormat)
            this._config.secondLineFormat = this._config.dateFormat;
        if (this._config.interval !== this._interval)
            this._interval = this._config.interval ?? 1000;
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        return changedProps.has('_firstLine') || changedProps.has('_secondLine') || changedProps.has('_thirdLine') || changedProps.has('_config') || changedProps.has('hass');
    }

    public async getCardSize(): Promise<number> {
        return 3;
    }

    protected updated(changedProperties: PropertyValues): void {
        super.updated(changedProperties);

        if (changedProperties.has('_interval')) {
            this._stopInterval();
            this._startInterval();
        }
        if (changedProperties.has('_config'))
            this._updateDateTime();
    }

    public connectedCallback(): void {
        super.connectedCallback();
        this._startInterval();
    }

    private _startInterval(): void {
        if (this._intervalId)
            return;

        this._intervalId = window.setInterval(this._updateDateTime.bind(this), this._interval);
    }

    private _stopInterval(): void {
        if (!this._intervalId)
            return;
        window.clearInterval(this._intervalId);
        this._intervalId = undefined;
    }

    private async _updateDateTime(): Promise<void> {
        const timeZone = this._config?.timeZone ?? this.hass?.config?.time_zone;
        const locale = this._config?.locale ?? this.hass?.locale?.language;
        const capitalize = this._config?.capitalize ?? "false";
        const ephemerize = this._config?.ephemerize ?? "false";

        let dateTime: DateTime = DateTime.local();
        /* if (!this._config?.useHATime) {
            dateTime = DateTime.local();
        } else {
            dateTime = DateTime.fromSeconds(await new Promise<number>((resolve) => {
                this.hass.connection.subscribeMessage(
                    (msg) => resolve(parseInt((msg as any).result, 10)),
                    {type: "render_template", template: '{{as_timestamp(now())}}'}
                );
            }));
        } */

        if (timeZone)
            dateTime = dateTime.setZone(timeZone);
        if (locale)
            dateTime = dateTime.setLocale(locale);

        let firstLine: string;
        let secondLine: string;

        if (typeof this._config?.firstLineFormat === 'string')
            firstLine = dateTime.toFormat(this._config.firstLineFormat);
        else
            firstLine = dateTime.toLocaleString(this._config?.firstLineFormat ?? {hour: '2-digit', minute: '2-digit'});

        if (typeof this._config?.secondLineFormat === 'string')
            secondLine = dateTime.toFormat(this._config.secondLineFormat);
        else
            secondLine = dateTime.toLocaleString(this._config?.secondLineFormat ?? {weekday: 'short', day: '2-digit', month: 'short'});

        if (firstLine !== this._firstLine)
            this._firstLine = firstLine;
        if (secondLine !== this._secondLine)
            this._secondLine = secondLine;

        if (capitalize===true) {
            let str = this._secondLine;
            str = str[0].toUpperCase() + str.slice(1);
            this._secondLine = str;

            const mySentence = this._secondLine;
            const finalSentence = mySentence.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
            this._secondLine = finalSentence;
        }

        if (ephemerize===true) {
            const n_day:number = Number(dateTime.toFormat('d'));
            const n_month:number = Number(dateTime.toFormat('M'));
            const str:string = String(Ephemeris.getEphemeris(n_day, n_month));
            this._thirdLine = str;
        }
            
    }

    public disconnectedCallback(): void {
        this._stopInterval();
        super.disconnectedCallback();
    }

    protected render(): TemplateResult | void {
        return html`
            <ha-card>
                <span class="first-line">${this._firstLine}</span>
                <span class="second-line">${this._secondLine}</span>
                <span class="third-line">---<br />${this._thirdLine}</span>
            </ha-card>
        `;
    }

    static get styles(): CSSResult {
        return css`
          ha-card {
            text-align: center;
            font-weight: bold;
            padding: 8px 0;
          }

          ha-card > span {
            display: block;
          }

          .first-line {
            font-size: 2.8em;
            line-height: 1em;
          }

          .second-line {
            font-size: 1.6em;
            line-height: 1em;
          }
          .third-line {
            font-size: 1.1em;
            line-height: 1em;
          }
        `;
    }
}
